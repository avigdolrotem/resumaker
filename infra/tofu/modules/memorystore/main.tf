resource "google_redis_instance" "main" {
  project        = var.project_id
  name           = "resumaker-${var.env}-redis"
  region         = var.region
  memory_size_gb = var.memory_size_gb
  redis_version  = "REDIS_7_2"
  tier           = var.env == "prod" ? "STANDARD_HA" : var.tier

  authorized_network      = var.network_id
  connect_mode            = "PRIVATE_SERVICE_ACCESS"
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  depends_on = [var.private_services_connection_ready]
}
