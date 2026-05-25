locals {
  env = "prod"
}

module "network" {
  source = "../../modules/gcp/network"

  project_id            = var.project_id
  region                = var.region
  env                   = local.env
  vpc_cidr              = "10.2.0.0/16"
  subnet_cidr           = "10.2.1.0/24"
  pods_cidr             = "10.2.16.0/20"
  services_cidr         = "10.2.32.0/20"
  private_services_cidr = "10.2.128.0/16"
}

module "workload_identity" {
  source = "../../modules/gcp/workload-identity"

  project_id        = var.project_id
  env               = local.env
  github_repo       = var.github_repo
  vercel_team_id    = var.vercel_team_id
  vercel_project_id = var.vercel_project_id
}

module "secrets" {
  source = "../../modules/gcp/secrets"

  project_id = var.project_id
  env        = local.env
  accessor_service_accounts = [
    module.workload_identity.app_service_account_email,
    module.workload_identity.cicd_service_account_email,
  ]
}

module "cloudsql" {
  source = "../../modules/gcp/cloudsql"

  project_id                        = var.project_id
  region                            = var.region
  env                               = local.env
  network_id                        = module.network.network_self_link
  private_services_connection_ready = module.network.private_services_connection
  tier                              = "db-custom-2-4096"

  iam_user_emails = [
    module.workload_identity.app_service_account_email,
  ]
}

module "memorystore" {
  source = "../../modules/gcp/memorystore"

  project_id                        = var.project_id
  region                            = var.region
  env                               = local.env
  network_id                        = module.network.network_self_link
  private_services_connection_ready = module.network.private_services_connection
}

module "artifactregistry" {
  source = "../../modules/gcp/artifactregistry"

  project_id = var.project_id
  region     = var.region

  writer_service_accounts = [
    module.workload_identity.cicd_service_account_email,
  ]
}

module "gcs" {
  source = "../../modules/gcp/gcs"

  project_id = var.project_id
  buckets    = {}
}

module "gke" {
  source = "../../modules/gcp/gke"

  project_id          = var.project_id
  region              = var.region
  env                 = local.env
  network_self_link   = module.network.network_self_link
  subnet_self_link    = module.network.subnet_self_link
  pods_range_name     = module.network.pods_range_name
  services_range_name = module.network.services_range_name
}
