variable "project" {
  description = "Project identifier (used in resource naming)"
  type        = string
}

variable "environment" {
  description = "Environment name: prod, staging, dev"
  type        = string
}

variable "aws_region" {
  description = "AWS region (used in ARN construction for IRSA)"
  type        = string
}

variable "vpc_id" {
  description = "VPC where EKS will live"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for worker nodes and control plane ENIs"
  type        = list(string)
}

variable "kubernetes_version" {
  description = "EKS Kubernetes version (use the latest GA — currently 1.31)"
  type        = string
  default     = "1.31"
}

variable "endpoint_public_access" {
  description = "Whether the cluster API server is reachable from the internet (lock to false after bootstrap)"
  type        = bool
  default     = true
}

variable "endpoint_public_access_cidrs" {
  description = "CIDRs allowed to reach the public API endpoint. Restrict to your office/VPN IP — 0.0.0.0/0 is dev-only."
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ─── Node group sizing ───

variable "node_instance_types" {
  description = "Instance types for the main managed node group"
  type        = list(string)
  default     = ["t3.small", "t3a.small"] # spot diversification
}

variable "node_capacity_type" {
  description = "ON_DEMAND or SPOT — spot saves ~70% but can be reclaimed"
  type        = string
  default     = "SPOT"

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type must be ON_DEMAND or SPOT."
  }
}

variable "node_min_size" {
  description = "Minimum nodes in the main group"
  type        = number
  default     = 1
}

variable "node_max_size" {
  description = "Maximum nodes the cluster can scale to"
  type        = number
  default     = 4
}

variable "node_desired_size" {
  description = "Initial node count"
  type        = number
  default     = 2
}

# ─── App-tier IRSA ───

variable "app_namespace" {
  description = "Kubernetes namespace for the resumaker app deployment"
  type        = string
  default     = "resumaker"
}

variable "app_service_account" {
  description = "ServiceAccount name the app pods will run as"
  type        = string
  default     = "resumaker-web"
}

variable "extra_secret_arns" {
  description = "Additional Secrets Manager ARNs External Secrets should be allowed to read"
  type        = list(string)
  default     = []
}
