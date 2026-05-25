variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "github_repo" {
  description = "owner/repo (e.g. resumaker/resumaker)"
  type        = string
}

variable "vercel_team_id" {
  description = "Vercel team id (find via `vercel teams list`). Used to bind WIF to the Vercel OIDC issuer."
  type        = string
}

variable "vercel_project_id" {
  description = "Vercel project id (find via `vercel project ls`)."
  type        = string
}
