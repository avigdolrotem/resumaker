module "network" {
  source = "../../modules/network"

  project     = var.project
  environment = var.environment
  vpc_cidr    = var.vpc_cidr
  azs         = ["${var.aws_region}a", "${var.aws_region}b"]

  # Cost-saving for dev: single NAT
  single_nat_gateway = true
}

# Future modules:
# module "eks" { ... }
# module "rds" { ... }
# module "redis" { ... }
# module "s3" { ... }
# module "secrets" { ... }
# module "route53" { ... }
