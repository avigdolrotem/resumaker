/**
 * VPC + subnets + gateways module.
 *
 * Creates:
 * - VPC with DNS support
 * - 2x public subnets (for ALB)
 * - 2x private subnets (for EKS, RDS, ElastiCache)
 * - Internet Gateway
 * - 1 NAT Gateway (cost-saving) or 1 per AZ (production)
 * - Routing tables
 */

locals {
  name_prefix     = "${var.project}-${var.environment}"
  public_subnets  = [for i, az in var.azs : cidrsubnet(var.vpc_cidr, 8, i)]
  private_subnets = [for i, az in var.azs : cidrsubnet(var.vpc_cidr, 8, i + 10)]
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${local.name_prefix}-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${local.name_prefix}-igw"
  }
}

resource "aws_subnet" "public" {
  count = length(var.azs)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = local.public_subnets[count.index]
  availability_zone       = var.azs[count.index]
  map_public_ip_on_launch = false # Even public subnets don't auto-assign IPs

  tags = {
    Name                                          = "${local.name_prefix}-public-${var.azs[count.index]}"
    "kubernetes.io/role/elb"                      = "1"
    "kubernetes.io/cluster/${local.name_prefix}"  = "shared"
  }
}

resource "aws_subnet" "private" {
  count = length(var.azs)

  vpc_id            = aws_vpc.main.id
  cidr_block        = local.private_subnets[count.index]
  availability_zone = var.azs[count.index]

  tags = {
    Name                                          = "${local.name_prefix}-private-${var.azs[count.index]}"
    "kubernetes.io/role/internal-elb"             = "1"
    "kubernetes.io/cluster/${local.name_prefix}"  = "shared"
  }
}

resource "aws_eip" "nat" {
  count  = var.single_nat_gateway ? 1 : length(var.azs)
  domain = "vpc"

  tags = {
    Name = "${local.name_prefix}-nat-eip-${count.index}"
  }
}

resource "aws_nat_gateway" "main" {
  count = var.single_nat_gateway ? 1 : length(var.azs)

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${local.name_prefix}-nat-${count.index}"
  }

  depends_on = [aws_internet_gateway.main]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${local.name_prefix}-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  count = length(var.azs)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table" "private" {
  count = length(var.azs)

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.single_nat_gateway ? aws_nat_gateway.main[0].id : aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "${local.name_prefix}-private-rt-${var.azs[count.index]}"
  }
}

resource "aws_route_table_association" "private" {
  count = length(var.azs)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[count.index].id
}
