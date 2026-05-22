variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "il-central-1"

  validation {
    condition     = contains(["il-central-1", "us-east-1"], var.aws_region)
    error_message = "Only il-central-1 (prod) or us-east-1 (dev/staging) are allowed."
  }
}

variable "environment" {
  description = "Deployment environment"
  type        = string

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "project" {
  description = "Project identifier"
  type        = string
  default     = "resumaker"
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
  default     = "10.0.0.0/16"
}

variable "domain_name" {
  description = "Primary domain name"
  type        = string
  default     = "resumaker.co.il"
}

variable "alert_email" {
  description = "Email for cost / operational alerts"
  type        = string
  default     = "rotem@avigdol.com"
}
