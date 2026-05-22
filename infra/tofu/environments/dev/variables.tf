variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "project" {
  description = "Project identifier"
  type        = string
  default     = "resumaker"
}

variable "vpc_cidr" {
  description = "VPC CIDR for dev"
  type        = string
  default     = "10.10.0.0/16"
}
