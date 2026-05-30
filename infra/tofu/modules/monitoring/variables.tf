variable "project_id" {
  description = "GCP project hosting Cloud Monitoring."
  type        = string
}

variable "env" {
  description = "Environment short-name (dev/staging/prod) — prefixes the uptime check's display name."
  type        = string
}

variable "host" {
  description = "Public hostname to probe (no scheme). e.g. `resumaker.co.il`."
  type        = string
}

variable "path" {
  description = "HTTP path to probe — should be cheap + side-effect-free. Defaults to `/api/health`."
  type        = string
  default     = "/api/health"
}

variable "period_sec" {
  description = "Seconds between probes. GCP minimum is 60s; 300s is the default to keep monthly costs negligible."
  type        = string
  default     = "300s"
}

variable "timeout_sec" {
  description = "Per-probe timeout. Anything longer than 10s usually means the app is unhealthy anyway."
  type        = string
  default     = "10s"
}

variable "regions" {
  description = "GCP probe regions. A spread across continents catches single-region outages."
  type        = list(string)
  default     = ["USA", "EUROPE", "ASIA_PACIFIC"]
}
