terraform {
  backend "s3" {
    bucket         = "resumaker-tofu-state"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "resumaker-tofu-locks"
    encrypt        = true
    # Using bucket-level SSE-S3 (AES256). Add KMS key for prod environment.
  }
}
