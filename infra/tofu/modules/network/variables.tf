variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "europe-west1"
}

variable "env" {
  description = "Environment name (dev|staging|prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.env)
    error_message = "env must be one of: dev, staging, prod."
  }
}

variable "subnet_cidr" {
  description = "Subnet CIDR within the VPC (e.g. 10.0.1.0/24)"
  type        = string
}

variable "pods_cidr" {
  description = "Secondary range for GKE pods (e.g. 10.0.16.0/20)"
  type        = string
}

variable "services_cidr" {
  description = "Secondary range for GKE services (e.g. 10.0.32.0/20)"
  type        = string
}

variable "private_services_cidr" {
  description = "/16 range reserved for Cloud SQL + Memorystore VPC peering"
  type        = string
}
