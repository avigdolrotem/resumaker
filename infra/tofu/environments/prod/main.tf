/**
 * Production environment composition.
 *
 * Provisions the base AWS infrastructure: network, RDS, S3, ECR.
 * EKS is provisioned separately via the terraform-aws-modules/eks
 * community module (see ./eks.tf — uncomment when ready).
 *
 * NOTE: this will create real AWS resources. Run `tofu plan` first
 * and review carefully. Expected first-month cost: $80-150.
 */

terraform {
  backend "s3" {
    bucket         = "resumaker-tofu-state"
    key            = "envs/prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "resumaker-tofu-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "resumaker"
      Environment = "prod"
      ManagedBy   = "opentofu"
      Owner       = "ops@resumaker.co.il"
    }
  }
}

# ─── Network ───
module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = "prod"
  vpc_cidr    = "10.0.0.0/16"
  azs         = ["${var.aws_region}a", "${var.aws_region}b"]

  # Prod = NAT per AZ for high availability
  single_nat_gateway = false
}

# ─── Database ───
module "rds" {
  source = "../../modules/rds"

  project            = var.project
  environment        = "prod"
  vpc_id             = module.network.vpc_id
  private_subnet_ids = module.network.private_subnet_ids

  # Prod sizing: small but with Multi-AZ + deletion protection
  instance_class               = "db.t3.small"
  allocated_storage            = 20
  max_allocated_storage        = 200
  multi_az                     = true
  deletion_protection          = true
  backup_retention_days        = 14
  skip_final_snapshot          = false
  performance_insights_enabled = true
}

# ─── Storage ───
module "s3" {
  source = "../../modules/s3"

  project       = var.project
  environment   = "prod"
  force_destroy = false
}

# ─── Container registry ───
module "ecr" {
  source = "../../modules/ecr"

  project      = var.project
  environment  = "prod"
  repositories = ["web"]
  force_delete = false
}

# ─── Cache ───
module "elasticache" {
  source = "../../modules/elasticache"

  project                    = var.project
  environment                = "prod"
  vpc_id                     = module.network.vpc_id
  private_subnet_ids         = module.network.private_subnet_ids
  allowed_security_group_ids = [module.eks.node_security_group_id]

  # Single node t4g.micro for v1 — flip to t4g.small + Multi-AZ once you hit ~100 paying users
  node_type          = "cache.t4g.micro"
  num_cache_clusters = 1
}

# ─── App-tier secrets (populated by CI on first deploy) ───
resource "aws_secretsmanager_secret" "app_secrets" {
  name        = "${var.project}-prod/app"
  description = "Application secrets (Anthropic, Resend, Sentry, Better Auth, Stripe, LemonSqueezy)"
}
