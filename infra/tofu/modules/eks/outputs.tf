output "cluster_name" {
  description = "EKS cluster name"
  value       = module.eks.cluster_name
}

output "cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64-encoded CA cert for the cluster"
  value       = module.eks.cluster_certificate_authority_data
  sensitive   = true
}

output "cluster_security_group_id" {
  description = "Security group attached to the cluster"
  value       = module.eks.cluster_security_group_id
}

output "node_security_group_id" {
  description = "Security group attached to the worker nodes"
  value       = module.eks.node_security_group_id
}

output "oidc_provider_arn" {
  description = "OIDC provider ARN — used to create IRSA roles for in-cluster workloads"
  value       = module.eks.oidc_provider_arn
}

output "oidc_provider_url" {
  description = "OIDC provider URL"
  value       = module.eks.cluster_oidc_issuer_url
}

# ─── IRSA role ARNs to wire into Helm chart values ───

output "alb_controller_role_arn" {
  description = "IRSA role for aws-load-balancer-controller"
  value       = module.alb_controller_irsa.iam_role_arn
}

output "external_secrets_role_arn" {
  description = "IRSA role for external-secrets operator"
  value       = module.external_secrets_irsa.iam_role_arn
}

output "cluster_autoscaler_role_arn" {
  description = "IRSA role for cluster-autoscaler"
  value       = module.cluster_autoscaler_irsa.iam_role_arn
}

output "app_role_arn" {
  description = "IRSA role for resumaker-web pods — attach to ServiceAccount"
  value       = module.app_irsa.iam_role_arn
}

# ─── kubeconfig helper ───

output "kubeconfig_command" {
  description = "Run this to update local kubeconfig"
  value       = "aws eks update-kubeconfig --region ${var.aws_region} --name ${module.eks.cluster_name}"
}
