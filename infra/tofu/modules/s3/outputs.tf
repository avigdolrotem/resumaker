output "bucket_names" {
  description = "Map of purpose -> bucket name"
  value       = { for k, b in aws_s3_bucket.this : k => b.id }
}

output "bucket_arns" {
  description = "Map of purpose -> bucket ARN"
  value       = { for k, b in aws_s3_bucket.this : k => b.arn }
}

output "files_bucket" {
  description = "User-files bucket name (most-used)"
  value       = aws_s3_bucket.this["files"].id
}
