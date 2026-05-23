/**
 * EKS cluster module — thin wrapper around terraform-aws-modules/eks.
 *
 * Why a wrapper:
 *   - locks the upstream module version
 *   - bakes in our naming, tagging, and security defaults
 *   - exposes IRSA helpers needed by ArgoCD / external-secrets / ALB-controller
 *
 * Cost note (il-central-1, prod defaults):
 *   - Control plane: ~$72/mo
 *   - 2× t3.small spot:  ~$13/mo
 *   - NAT gateway (in network module): ~$32/mo per AZ
 *   - Plan for ~$120-180/mo bare cluster before app traffic.
 */

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source = "hashicorp/aws"
      # terraform-aws-modules/eks 20.x pulls submodules requiring 5.95+;
      # keep this loose so the resolver can pick a compatible version.
      version = ">= 5.95.0, < 6.0.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.32"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.15"
    }
  }
}

locals {
  name = "${var.project}-${var.environment}"

  default_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "opentofu"
    Module      = "eks"
  }
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.31"

  cluster_name    = local.name
  cluster_version = var.kubernetes_version

  vpc_id                   = var.vpc_id
  subnet_ids               = var.private_subnet_ids
  control_plane_subnet_ids = var.private_subnet_ids

  # Public endpoint disabled by default; ops connects via VPN or AWS SSM.
  # Flip to true for first bootstrap, then back to false.
  cluster_endpoint_public_access  = var.endpoint_public_access
  cluster_endpoint_private_access = true

  cluster_endpoint_public_access_cidrs = var.endpoint_public_access_cidrs

  # Authentication: API_AND_CONFIG_MAP lets us seed the bootstrap admin
  # via aws-auth ConfigMap while migrating to EKS Access Entries.
  authentication_mode                      = "API_AND_CONFIG_MAP"
  enable_cluster_creator_admin_permissions = true

  # Encrypt secrets at rest with a dedicated KMS key.
  cluster_encryption_config = {
    resources = ["secrets"]
  }

  # Core addons that should always be present and managed by AWS.
  cluster_addons = {
    coredns = {
      most_recent = true
    }
    kube-proxy = {
      most_recent = true
    }
    vpc-cni = {
      most_recent = true
      configuration_values = jsonencode({
        env = {
          ENABLE_PREFIX_DELEGATION = "true" # More pod IPs per node
        }
      })
    }
    aws-ebs-csi-driver = {
      most_recent              = true
      service_account_role_arn = module.ebs_csi_irsa.iam_role_arn
    }
  }

  # Managed node group — single group keeps cost predictable.
  # Override via `node_groups` variable for staging/load tests.
  eks_managed_node_group_defaults = {
    ami_type          = "AL2023_x86_64_STANDARD"
    instance_types    = var.node_instance_types
    capacity_type     = var.node_capacity_type
    disk_size         = 30
    enable_monitoring = true

    # IMDSv2 only — prevents SSRF-style pod escape attacks
    metadata_options = {
      http_endpoint               = "enabled"
      http_tokens                 = "required"
      http_put_response_hop_limit = 2
    }
  }

  eks_managed_node_groups = {
    main = {
      name = "main"

      min_size     = var.node_min_size
      max_size     = var.node_max_size
      desired_size = var.node_desired_size

      labels = {
        role = "general"
      }
    }
  }

  tags = local.default_tags
}

# ─── IRSA roles for cluster-level addons ───

# EBS CSI — required by aws-ebs-csi-driver addon above
module "ebs_csi_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.48"

  role_name             = "${local.name}-ebs-csi"
  attach_ebs_csi_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:ebs-csi-controller-sa"]
    }
  }

  tags = local.default_tags
}

# AWS Load Balancer Controller — manages ALB/NLB via Ingress resources
module "alb_controller_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.48"

  role_name                              = "${local.name}-alb-controller"
  attach_load_balancer_controller_policy = true

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:aws-load-balancer-controller"]
    }
  }

  tags = local.default_tags
}

# External Secrets Operator — pulls from Secrets Manager + SSM
module "external_secrets_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.48"

  role_name                      = "${local.name}-external-secrets"
  attach_external_secrets_policy = true
  external_secrets_secrets_manager_arns = concat(
    ["arn:aws:secretsmanager:${var.aws_region}:*:secret:${var.project}-${var.environment}/*"],
    var.extra_secret_arns,
  )

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["external-secrets:external-secrets"]
    }
  }

  tags = local.default_tags
}

# Cluster Autoscaler IRSA — used by managed node group autoscaling
module "cluster_autoscaler_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.48"

  role_name                        = "${local.name}-cluster-autoscaler"
  attach_cluster_autoscaler_policy = true
  cluster_autoscaler_cluster_names = [module.eks.cluster_name]

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["kube-system:cluster-autoscaler"]
    }
  }

  tags = local.default_tags
}

# App-tier service account IRSA — used by the resumaker web pods to
# read app secrets from Secrets Manager directly (fallback when ESO
# isn't yet installed)
module "app_irsa" {
  source  = "terraform-aws-modules/iam/aws//modules/iam-role-for-service-accounts-eks"
  version = "~> 5.48"

  role_name = "${local.name}-app"

  role_policy_arns = {
    secrets_read = aws_iam_policy.app_secrets_read.arn
  }

  oidc_providers = {
    main = {
      provider_arn               = module.eks.oidc_provider_arn
      namespace_service_accounts = ["${var.app_namespace}:${var.app_service_account}"]
    }
  }

  tags = local.default_tags
}

data "aws_caller_identity" "current" {}

resource "aws_iam_policy" "app_secrets_read" {
  name        = "${local.name}-app-secrets-read"
  description = "Read app-tier secrets for resumaker pods"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret",
        ]
        Resource = [
          "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project}-${var.environment}/*",
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
        ]
        Resource = [
          "arn:aws:s3:::${var.project}-${var.environment}-files/*",
        ]
      },
      {
        Effect = "Allow"
        Action = ["s3:ListBucket"]
        Resource = [
          "arn:aws:s3:::${var.project}-${var.environment}-files",
        ]
      },
    ]
  })

  tags = local.default_tags
}
