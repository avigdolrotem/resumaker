output "host" {
  value = google_redis_instance.main.host
}

output "port" {
  value = google_redis_instance.main.port
}

output "redis_url" {
  description = "rediss:// URL for the app to use (includes AUTH string)"
  # Memorystore generates the auth_string when auth_enabled=true.
  # Format: rediss://default:<auth_string>@<host>:<port>
  # The 'default' user is the only username Memorystore accepts.
  value     = "rediss://default:${google_redis_instance.main.auth_string}@${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive = true
}

output "auth_string" {
  description = "Raw Redis AUTH string — operator pushes this into Secret Manager"
  value       = google_redis_instance.main.auth_string
  sensitive   = true
}
