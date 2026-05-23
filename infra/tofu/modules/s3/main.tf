/**
 * S3 buckets module — creates encrypted, versioned buckets for the project.
 *
 * Buckets created (with project-environment prefix):
 *   - files       — user-uploaded files (PDFs, resume sources)
 *   - static      — public assets (avatars later)
 *   - backups     — RDS dumps, periodic backups
 *   - logs        — long-term log archive
 *
 * All buckets:
 *   - Server-side encrypted (SSE-S3 by default; pass KMS key for stricter)
 *   - Versioned
 *   - Public access blocked
 *   - Lifecycle policy on non-current versions (30d cleanup)
 */

locals {
  name_prefix = "${var.project}-${var.environment}"
  buckets = {
    files   = { public = false, versioning = true, lifecycle_days = 365 }
    static  = { public = true, versioning = false, lifecycle_days = 30 }
    backups = { public = false, versioning = true, lifecycle_days = 90 }
    logs    = { public = false, versioning = false, lifecycle_days = 365 }
  }
}

resource "aws_s3_bucket" "this" {
  for_each      = local.buckets
  bucket        = "${local.name_prefix}-${each.key}"
  force_destroy = var.force_destroy

  tags = {
    Name    = "${local.name_prefix}-${each.key}"
    Purpose = each.key
  }
}

# ─── Encryption (SSE-S3 unless KMS key provided) ───
resource "aws_s3_bucket_server_side_encryption_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = var.kms_key_arn != null ? "aws:kms" : "AES256"
      kms_master_key_id = var.kms_key_arn
    }
    bucket_key_enabled = var.kms_key_arn != null
  }
}

# ─── Versioning ───
resource "aws_s3_bucket_versioning" "this" {
  for_each = { for k, v in local.buckets : k => v if v.versioning }
  bucket   = aws_s3_bucket.this[each.key].id
  versioning_configuration {
    status = "Enabled"
  }
}

# ─── Public access block (private buckets) ───
resource "aws_s3_bucket_public_access_block" "private" {
  for_each = { for k, v in local.buckets : k => v if !v.public }
  bucket   = aws_s3_bucket.this[each.key].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ─── Lifecycle: clean up non-current versions ───
resource "aws_s3_bucket_lifecycle_configuration" "this" {
  for_each = aws_s3_bucket.this
  bucket   = each.value.id

  rule {
    id     = "trim-noncurrent-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_expiration {
      noncurrent_days = local.buckets[each.key].lifecycle_days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}
