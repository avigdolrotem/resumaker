variable "project" {
  description = "Project name"
  type        = string
}

variable "environment" {
  description = "Environment (dev/staging/prod)"
  type        = string
}

variable "repositories" {
  description = "List of repository names (one per service)"
  type        = list(string)
  default     = ["web"]
}

variable "force_delete" {
  description = "Allow tofu destroy on non-empty repos (dev only)"
  type        = bool
  default     = false
}
