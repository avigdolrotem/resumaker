output "primary_endpoint" {
  description = "Redis primary endpoint hostname"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "port" {
  description = "Redis port"
  value       = 6379
}

output "security_group_id" {
  description = "Security group attached to Redis nodes"
  value       = aws_security_group.redis.id
}

output "secret_arn" {
  description = "Secrets Manager ARN holding the Redis connection URL (key: 'url')"
  value       = aws_secretsmanager_secret.redis_url.arn
}

output "secret_name" {
  description = "Secrets Manager secret name (for ExternalSecret references)"
  value       = aws_secretsmanager_secret.redis_url.name
}
