variable "project_id" {
  type = string
}

variable "buckets" {
  description = "Map of logical name → settings."
  type = map(object({
    location      = string
    storage_class = optional(string, "STANDARD")
    versioning    = optional(bool, true)
    force_destroy = optional(bool, false)
  }))
  default = {}
}
