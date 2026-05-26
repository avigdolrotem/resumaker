output "cluster_kubectl_command" {
  value = module.gke.kubectl_context_command
}

output "cloudsql_connection_name" {
  value = module.cloudsql.instance_connection_name
}

output "memorystore_host" {
  value = module.memorystore.host
}

output "artifact_registry_url" {
  value = module.artifactregistry.repository_url
}

output "app_service_account_email" {
  value = module.workload_identity.app_service_account_email
}

output "cicd_service_account_email" {
  value = module.workload_identity.cicd_service_account_email
}

output "wif_github_provider" {
  value = module.workload_identity.github_provider_name
}
