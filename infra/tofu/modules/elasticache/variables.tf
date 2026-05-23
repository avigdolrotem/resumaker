variable "project" {
  description = "Project identifier (used in resource naming)"
  type        = string
}

variable "environment" {
  description = "Environment name: prod, staging, dev"
  type        = string
}

variable "vpc_id" {
  description = "VPC where Redis will live"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnets for Redis nodes (must span 2+ AZs for Multi-AZ)"
  type        = list(string)
}

variable "allowed_security_group_ids" {
  description = "Security group IDs allowed to reach Redis on 6379 (typically the EKS node SG)"
  type        = list(string)
}

# ─── Sizing ─────────────────────────────────────────────────────────

variable "node_type" {
  description = "Cache node type. t4g.micro = cheapest (~$13/mo), t4g.small = recommended for prod"
  type        = string
  default     = "cache.t4g.micro"
}

variable "engine_version" {
  description = "Redis engine version (use 7.x for Lua + streams)"
  type        = string
  default     = "7.1"
}

variable "parameter_group_family" {
  description = "Parameter group family (must match engine major version)"
  type        = string
  default     = "redis7"
}

variable "num_cache_clusters" {
  description = "Number of cache nodes. 1 = single node (cheapest), 2+ = automatic failover Multi-AZ"
  type        = number
  default     = 1
}

# ─── Backups & maintenance ──────────────────────────────────────────

variable "snapshot_retention_days" {
  description = "How many daily snapshots to keep (0 = no snapshots, max 35)"
  type        = number
  default     = 7
}

variable "apply_immediately" {
  description = "Apply config changes immediately (true) or wait for maintenance window (false)"
  type        = bool
  default     = false
}

variable "log_retention_days" {
  description = "CloudWatch log retention for slow/engine logs"
  type        = number
  default     = 7
}

# ─── Security ───────────────────────────────────────────────────────

variable "auth_token_enabled" {
  description = "Generate a Redis AUTH token (recommended for any non-toy environment)"
  type        = bool
  default     = true
}
