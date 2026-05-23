output "endpoint" {
  description = "DB endpoint (host:port)"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "DB host"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "DB port"
  value       = aws_db_instance.main.port
}

output "database_name" {
  description = "Initial database name"
  value       = aws_db_instance.main.db_name
}

output "security_group_id" {
  description = "Security group attached to the DB"
  value       = aws_security_group.db.id
}

output "credentials_secret_arn" {
  description = "ARN of the Secrets Manager secret holding DB credentials"
  value       = aws_secretsmanager_secret.db_credentials.arn
}

output "credentials_secret_name" {
  description = "Name of the Secrets Manager secret"
  value       = aws_secretsmanager_secret.db_credentials.name
}
