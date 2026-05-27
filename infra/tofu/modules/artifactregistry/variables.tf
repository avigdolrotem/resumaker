variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "repository_id" {
  type    = string
  default = "resumaker"
}

variable "writer_service_accounts" {
  description = "SA emails that need push permission (typically the cicd SA)."
  type        = list(string)
  default     = []
}

variable "reader_service_accounts" {
  description = "SA emails that need pull permission (typically GKE node SA + app SAs)."
  type        = list(string)
  default     = []
}
