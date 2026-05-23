variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "kms_key_arn" {
  description = "Optional KMS key ARN for SSE-KMS encryption (otherwise SSE-S3)"
  type        = string
  default     = null
}

variable "force_destroy" {
  description = "Allow tofu destroy on non-empty buckets (dev only)"
  type        = bool
  default     = false
}
