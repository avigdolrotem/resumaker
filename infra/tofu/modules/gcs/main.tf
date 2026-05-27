resource "google_storage_bucket" "buckets" {
  for_each = var.buckets

  project       = var.project_id
  name          = each.key
  location      = each.value.location
  storage_class = each.value.storage_class
  force_destroy = each.value.force_destroy

  versioning {
    enabled = each.value.versioning
  }

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
}
