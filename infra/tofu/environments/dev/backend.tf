terraform {
  backend "s3" {
    bucket         = "resumaker-tofu-state"
    key            = "envs/dev/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "resumaker-tofu-locks"
    encrypt        = true
    kms_key_id     = "alias/resumaker-tofu-state"

    # Force MFA for state operations in prod (uncomment when MFA configured)
    # role_arn   = "arn:aws:iam::857812839967:role/TofuStateAccess"
  }
}
