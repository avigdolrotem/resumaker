locals {
  cluster_name = "resumaker-${var.env}"
}

resource "google_container_cluster" "main" {
  provider = google-beta

  project  = var.project_id
  name     = local.cluster_name
  location = var.region

  enable_autopilot = true

  release_channel {
    channel = var.release_channel
  }

  network    = var.network_self_link
  subnetwork = var.subnet_self_link

  ip_allocation_policy {
    cluster_secondary_range_name  = var.pods_range_name
    services_secondary_range_name = var.services_range_name
  }

  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  master_authorized_networks_config {
    # No allowlist by default — the cluster control plane is publicly accessible
    # but requires gcloud-auth. Add a CIDR block when you have a bastion or
    # known CI runner IP. Example:
    # cidr_blocks {
    #   cidr_block   = "203.0.113.5/32"
    #   display_name = "ops-bastion"
    # }
  }

  deletion_protection = var.env == "prod"
}
