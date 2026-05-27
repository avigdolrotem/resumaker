output "bucket_urls" {
  value = { for k, v in google_storage_bucket.buckets : k => v.url }
}
