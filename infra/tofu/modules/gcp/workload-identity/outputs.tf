output "pool_name" {
  value = google_iam_workload_identity_pool.main.name
}

output "github_provider_name" {
  value = google_iam_workload_identity_pool_provider.github.name
}

output "vercel_provider_name" {
  value = google_iam_workload_identity_pool_provider.vercel.name
}

output "app_service_account_email" {
  value = google_service_account.app.email
}

output "cicd_service_account_email" {
  value = google_service_account.cicd.email
}
