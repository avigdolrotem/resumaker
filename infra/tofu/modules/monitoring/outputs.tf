output "uptime_check_id" {
  description = "Cloud Monitoring uptime check resource ID — wire this into alert policies."
  value       = google_monitoring_uptime_check_config.app.uptime_check_id
}

output "uptime_check_name" {
  description = "Fully qualified resource name of the uptime check."
  value       = google_monitoring_uptime_check_config.app.name
}
