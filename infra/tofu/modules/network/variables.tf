variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "vpc_cidr" {
  description = "VPC CIDR block"
  type        = string
}

variable "azs" {
  description = "Availability zones"
  type        = list(string)
}

variable "single_nat_gateway" {
  description = "Use 1 NAT gateway for cost-saving (dev) instead of one per AZ"
  type        = bool
  default     = false
}
