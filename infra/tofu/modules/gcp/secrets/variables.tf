variable "project_id" {
  type = string
}

variable "env" {
  type = string
}

variable "secret_names" {
  description = "List of secret names to provision (empty values; populate post-create via gcloud)."
  type        = list(string)
  default = [
    "anthropic-api-key",
    "ai-gateway-api-key",
    "better-auth-secret",
    "ip-hash-salt",
    "cron-secret",
    "resend-api-key",
    "sentry-dsn",
    "vapid-private-key",
    "stripe-secret-key",
    "stripe-webhook-secret",
    "lemonsqueezy-api-key",
    "lemonsqueezy-webhook-secret",
    "firecrawl-api-key",
  ]
}

variable "accessor_service_accounts" {
  description = "SA emails that can read secrets via secretAccessor role."
  type        = list(string)
  default     = []
}
