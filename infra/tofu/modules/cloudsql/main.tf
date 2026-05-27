locals {
  name_prefix = "resumaker-${var.env}"
}

resource "random_id" "instance_suffix" {
  byte_length = 2
}

resource "google_sql_database_instance" "main" {
  project          = var.project_id
  name             = "${local.name_prefix}-pg-${random_id.instance_suffix.hex}"
  database_version = var.database_version
  region           = var.region

  depends_on = [var.private_services_connection_ready]

  settings {
    tier              = var.tier
    availability_type = var.env == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = 20
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      point_in_time_recovery_enabled = true
      start_time                     = "02:00"
      backup_retention_settings {
        retained_backups = var.env == "prod" ? 30 : 7
      }
    }

    ip_configuration {
      ipv4_enabled                                  = var.enable_public_ip
      private_network                               = var.network_id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"
    }

    database_flags {
      name  = "cloudsql.iam_authentication"
      value = "on"
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = false
      record_client_address   = false
    }
  }

  deletion_protection = var.env == "prod"
}

resource "google_sql_database" "main" {
  project  = var.project_id
  name     = "resumaker"
  instance = google_sql_database_instance.main.name
}

resource "google_sql_user" "iam_users" {
  for_each = toset(var.iam_user_emails)
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  name     = trimsuffix(each.value, ".gserviceaccount.com")
  type     = "CLOUD_IAM_SERVICE_ACCOUNT"
}
