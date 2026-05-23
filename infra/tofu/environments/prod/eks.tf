/**
 * EKS cluster + cluster-level addons for prod.
 *
 * The cluster itself is intentionally bare — only AWS-managed addons
 * (coredns, kube-proxy, vpc-cni, ebs-csi) live in OpenTofu. Everything
 * else (ALB controller, External Secrets, ArgoCD, cert-manager) is
 * installed via Helm releases below so that ArgoCD eventually manages
 * itself and the app charts after bootstrap.
 *
 * Bootstrap order:
 *   1. tofu apply (this file) — cluster + node group + IRSA roles
 *   2. aws eks update-kubeconfig ... (use output above)
 *   3. helm releases below run via terraform on next apply
 *   4. ArgoCD becomes self-managing; future app changes go through git
 */

module "eks" {
  source = "../../modules/eks"

  project            = var.project
  environment        = "prod"
  aws_region         = var.aws_region
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids

  # Public API endpoint stays on for the initial `tofu apply` so we can
  # reach it from outside the VPC to install ArgoCD/etc. Once GitOps is
  # bootstrapped, **set `endpoint_public_access = false` (or restrict to
  # your VPN CIDR in `endpoint_public_access_cidrs`)** to close the
  # cluster API to the open internet. Leaving it at the default 0.0.0.0/0
  # is a launch-blocker.
  endpoint_public_access       = true
  endpoint_public_access_cidrs = var.eks_public_access_cidrs

  # 2x t3.small spot keeps the cluster around ~$13/mo for nodes
  node_instance_types = ["t3.small", "t3a.small"]
  node_capacity_type  = "SPOT"
  node_min_size       = 1
  node_max_size       = 4
  node_desired_size   = 2

  extra_secret_arns = [
    aws_secretsmanager_secret.app_secrets.arn,
    module.elasticache.secret_arn,
  ]
}

# Configure providers that need the cluster's CA + auth token. These
# `data` lookups intentionally depend on the cluster being created
# first; OpenTofu resolves the order automatically.
data "aws_eks_cluster_auth" "this" {
  name = module.eks.cluster_name
}

provider "kubernetes" {
  host                   = module.eks.cluster_endpoint
  cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
  token                  = data.aws_eks_cluster_auth.this.token
}

provider "helm" {
  kubernetes {
    host                   = module.eks.cluster_endpoint
    cluster_ca_certificate = base64decode(module.eks.cluster_certificate_authority_data)
    token                  = data.aws_eks_cluster_auth.this.token
  }
}

# ─── App namespace ─────────────────────────────────────────────────
# Created in tofu so the IRSA-bound ServiceAccount below has a home.
resource "kubernetes_namespace" "app" {
  metadata {
    name = "resumaker"
    labels = {
      "app.kubernetes.io/managed-by" = "opentofu"
    }
  }
}

# ServiceAccount the resumaker-web pods will use. IRSA annotation
# binds it to the app role created in the EKS module.
resource "kubernetes_service_account" "app" {
  metadata {
    name      = "resumaker-web"
    namespace = kubernetes_namespace.app.metadata[0].name
    annotations = {
      "eks.amazonaws.com/role-arn" = module.eks.app_role_arn
    }
  }
}

# ─── Cluster-level controllers (installed via Helm) ────────────────

# AWS Load Balancer Controller — provisions ALB/NLB for Ingress
resource "helm_release" "aws_load_balancer_controller" {
  name       = "aws-load-balancer-controller"
  namespace  = "kube-system"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.10.0"

  set {
    name  = "clusterName"
    value = module.eks.cluster_name
  }
  set {
    name  = "serviceAccount.create"
    value = "true"
  }
  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.eks.alb_controller_role_arn
  }
  set {
    name  = "region"
    value = var.aws_region
  }
  set {
    name  = "vpcId"
    value = module.network.vpc_id
  }
}

# External Secrets Operator — syncs Secrets Manager → K8s Secrets
resource "helm_release" "external_secrets" {
  name             = "external-secrets"
  namespace        = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.4"
  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = module.eks.external_secrets_role_arn
  }
}

# cert-manager — issues TLS certs for Ingresses
resource "helm_release" "cert_manager" {
  name             = "cert-manager"
  namespace        = "cert-manager"
  repository       = "https://charts.jetstack.io"
  chart            = "cert-manager"
  version          = "v1.16.1"
  create_namespace = true

  set {
    name  = "installCRDs"
    value = "true"
  }
}

# ArgoCD — GitOps controller. Self-managing after bootstrap.
resource "helm_release" "argocd" {
  name             = "argocd"
  namespace        = "argocd"
  repository       = "https://argoproj.github.io/argo-helm"
  chart            = "argo-cd"
  version          = "7.7.7"
  create_namespace = true

  # Use ALB Ingress instead of LoadBalancer for cost + cert-manager support
  values = [yamlencode({
    global = {
      domain = var.argocd_domain
    }
    configs = {
      params = {
        # ArgoCD ALB does TLS termination; server speaks insecure HTTP behind it
        "server.insecure" = "true"
      }
    }
    server = {
      service = {
        type = "ClusterIP"
      }
      ingress = {
        enabled          = true
        ingressClassName = "alb"
        annotations = {
          "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
          "alb.ingress.kubernetes.io/target-type"      = "ip"
          "alb.ingress.kubernetes.io/listen-ports"     = "[{\"HTTPS\":443}]"
          "alb.ingress.kubernetes.io/ssl-redirect"     = "443"
          "alb.ingress.kubernetes.io/certificate-arn"  = var.argocd_acm_cert_arn
          "alb.ingress.kubernetes.io/healthcheck-path" = "/healthz"
        }
        hosts = [var.argocd_domain]
      }
    }
    notifications = {
      enabled = false # turn on after Slack webhook is set up
    }
  })]

  depends_on = [helm_release.aws_load_balancer_controller]
}
