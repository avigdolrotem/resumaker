output "host" {
  value = google_redis_instance.main.host
}

output "port" {
  value = google_redis_instance.main.port
}

output "redis_url" {
  description = "rediss:// URL for the app to use"
  value       = "rediss://${google_redis_instance.main.host}:${google_redis_instance.main.port}"
  sensitive   = true
}
