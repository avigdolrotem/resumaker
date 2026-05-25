output "network_id" {
  value = google_compute_network.main.id
}

output "network_name" {
  value = google_compute_network.main.name
}

output "network_self_link" {
  value = google_compute_network.main.self_link
}

output "subnet_id" {
  value = google_compute_subnetwork.main.id
}

output "subnet_name" {
  value = google_compute_subnetwork.main.name
}

output "subnet_self_link" {
  value = google_compute_subnetwork.main.self_link
}

output "pods_range_name" {
  value = "resumaker-${var.env}-pods"
}

output "services_range_name" {
  value = "resumaker-${var.env}-services"
}

output "private_services_connection" {
  value = google_service_networking_connection.private_services.network
}
