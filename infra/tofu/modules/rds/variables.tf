variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "vpc_id" {
  description = "VPC ID where the DB will live"
  type        = string
}

variable "private_subnet_ids" {
  description = "Private subnet IDs for the DB subnet group (at least 2 across AZs)"
  type        = list(string)
}

variable "app_security_group_ids" {
  description = "Security group IDs allowed to connect on 5432"
  type        = list(string)
  default     = []
}

variable "engine_version" {
  description = "Postgres engine version"
  type        = string
  default     = "17.2"
}

variable "instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "allocated_storage" {
  description = "Initial storage (GB)"
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Storage autoscaling upper bound (GB)"
  type        = number
  default     = 100
}

variable "database_name" {
  description = "Initial database name"
  type        = string
  default     = "resumaker"
}

variable "master_username" {
  description = "Master DB user"
  type        = string
  default     = "resumaker_admin"
}

variable "multi_az" {
  description = "Enable Multi-AZ failover (recommended for prod)"
  type        = bool
  default     = false
}

variable "deletion_protection" {
  description = "Block deletion via API"
  type        = bool
  default     = false
}

variable "backup_retention_days" {
  description = "Days to keep automated snapshots"
  type        = number
  default     = 7
}

variable "skip_final_snapshot" {
  description = "Skip the final snapshot on destroy (use only in dev)"
  type        = bool
  default     = true
}

variable "performance_insights_enabled" {
  description = "Enable Performance Insights (costs extra)"
  type        = bool
  default     = false
}
