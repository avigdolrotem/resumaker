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
