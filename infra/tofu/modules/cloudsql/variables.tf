variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "network_id" {
  description = "Self-link of the VPC (from network module)."
  type        = string
}

variable "private_services_connection_ready" {
  description = "Pass network module's `private_services_connection` output to create an explicit dependency."
  type        = any
  default     = null
}

variable "tier" {
  description = "Machine tier — db-g1-small for non-prod, db-custom-2-4096 for prod."
  type        = string
  default     = "db-g1-small"
}

variable "availability_type" {
  description = "Override Cloud SQL availability type. null = default by env (prod=REGIONAL/HA, else ZONAL)."
  type        = string
  default     = null
}

variable "database_version" {
  type    = string
  default = "POSTGRES_15"
}

variable "iam_user_emails" {
  description = "SA emails that should become Cloud SQL IAM DB users (no password required)."
  type        = list(string)
  default     = []
}

variable "enable_public_ip" {
  description = "Enable Cloud SQL public IPv4 endpoint. Default false — set true only if you need to reach the DB from outside the VPC (e.g. Vercel previews or local dev via Cloud SQL Auth Proxy)."
  type        = bool
  default     = false
}
