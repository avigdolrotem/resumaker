variable "project_id" {
  type    = string
  default = "resumaker-prod"
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "github_repo" {
  type    = string
  default = "resumaker/resumaker"
}

variable "vercel_team_id" {
  type = string
}

variable "vercel_project_id" {
  type = string
}
