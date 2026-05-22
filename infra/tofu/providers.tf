provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "resumaker"
      Environment = var.environment
      ManagedBy   = "opentofu"
      Owner       = "rotem@avigdol.com"
    }
  }
}
