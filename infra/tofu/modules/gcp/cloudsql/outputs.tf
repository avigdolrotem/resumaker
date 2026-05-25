output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "Use this in @google-cloud/cloud-sql-connector"
  value       = google_sql_database_instance.main.connection_name
}

output "instance_public_ip" {
  value = google_sql_database_instance.main.public_ip_address
}

output "instance_private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.main.name
}
