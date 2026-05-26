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
  description = "Self-link of the VPC."
  type        = string
}

variable "private_services_connection_ready" {
  type    = any
  default = null
}

variable "memory_size_gb" {
  type    = number
  default = 1
}

variable "tier" {
  type    = string
  default = "BASIC"
}
