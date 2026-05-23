output "vpc_id" {
  value = module.network.vpc_id
}

output "private_subnet_ids" {
  value = module.network.private_subnet_ids
}

output "rds_endpoint" {
  value     = module.rds.endpoint
  sensitive = true
}

output "rds_credentials_secret" {
  description = "Secrets Manager ARN holding DB credentials JSON"
  value       = module.rds.credentials_secret_arn
}

output "s3_buckets" {
  value = module.s3.bucket_names
}

output "ecr_repos" {
  value = module.ecr.repository_urls
}

output "app_secrets_arn" {
  value = aws_secretsmanager_secret.app_secrets.arn
}

output "eks_cluster_name" {
  description = "EKS cluster name — pass to kubectl/helm commands"
  value       = module.eks.cluster_name
}

output "eks_cluster_endpoint" {
  description = "EKS API server endpoint"
  value       = module.eks.cluster_endpoint
}

output "eks_kubeconfig_command" {
  description = "Run this after `tofu apply` to update local kubeconfig"
  value       = module.eks.kubeconfig_command
}

output "eks_app_role_arn" {
  description = "IRSA role for resumaker-web pods — referenced in Helm values"
  value       = module.eks.app_role_arn
}

output "redis_endpoint" {
  description = "ElastiCache Redis primary endpoint (private DNS)"
  value       = module.elasticache.primary_endpoint
}

output "redis_secret_arn" {
  description = "Secrets Manager ARN holding Redis connection URL"
  value       = module.elasticache.secret_arn
}
