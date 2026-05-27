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

variable "network_self_link" {
  type = string
}

variable "subnet_self_link" {
  type = string
}

variable "pods_range_name" {
  type = string
}

variable "services_range_name" {
  type = string
}

variable "release_channel" {
  type    = string
  default = "REGULAR"
}
