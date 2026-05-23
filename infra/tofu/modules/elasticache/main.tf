/**
 * ElastiCache Redis module — single-node serverless or replication group.
 *
 * Used for:
 *   - Rate limiting (atomic INCR with Lua script in apps/web/src/lib/rate-limit.ts)
 *   - Future: session cache, OAuth state store, queue
 *
 * Cost note (il-central-1):
 *   - cache.t4g.micro single-AZ: ~$13/mo (entry tier — fine for v1)
 *   - cache.t4g.small Multi-AZ:  ~$54/mo (recommended once paid traffic > 100 users/mo)
 *   - Serverless ElastiCache: pay-per-request, ~$0.06/GB-hour + $0.0034/GB data — cheaper at low volume but spikes are unpredictable
 *
 * Network: lives in the same private subnets as RDS. Only reachable
 * from the EKS node SG (security_group_ids passed in by caller).
 */

terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0, < 6.0.0"
    }
  }
}

locals {
  name = "${var.project}-${var.environment}"
  default_tags = {
    Project     = var.project
    Environment = var.environment
    ManagedBy   = "opentofu"
    Module      = "elasticache"
  }
}

# Subnet group — Redis nodes go in private subnets
resource "aws_elasticache_subnet_group" "main" {
  name        = "${local.name}-redis"
  description = "Resumaker Redis subnet group"
  subnet_ids  = var.private_subnet_ids

  tags = local.default_tags
}

# Security group — allow ingress from EKS nodes on port 6379
resource "aws_security_group" "redis" {
  name        = "${local.name}-redis-sg"
  description = "Allow Redis access from EKS nodes"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Redis from EKS nodes"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = var.allowed_security_group_ids
  }

  egress {
    description = "Allow all egress (Redis nodes need to reach AWS APIs for backup/metrics)"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(local.default_tags, { Name = "${local.name}-redis-sg" })
}

# Parameter group — opinionated defaults (eviction policy, etc.)
resource "aws_elasticache_parameter_group" "main" {
  family      = var.parameter_group_family
  name        = "${local.name}-redis-params"
  description = "Resumaker Redis parameters"

  # allkeys-lru: when memory is full, evict least-recently-used keys
  # of any type. Right for our use case (rate-limit + cache) because
  # every key has a natural TTL.
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  tags = local.default_tags
}

# Replication group — even for single-node we use this API because it
# supports encryption at rest and in transit. Standalone `aws_elasticache_cluster`
# does not.
resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "${local.name}-redis"
  description          = "Resumaker Redis for rate limiting and cache"

  engine               = "redis"
  engine_version       = var.engine_version
  node_type            = var.node_type
  parameter_group_name = aws_elasticache_parameter_group.main.name
  port                 = 6379

  num_cache_clusters         = var.num_cache_clusters
  multi_az_enabled           = var.num_cache_clusters > 1
  automatic_failover_enabled = var.num_cache_clusters > 1

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Encryption: at rest + in transit (auth token only when TLS is on)
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.auth_token_enabled ? random_password.auth_token[0].result : null

  # Backups (cheap insurance)
  snapshot_retention_limit = var.snapshot_retention_days
  snapshot_window          = "03:00-04:00" # UTC; corresponds to 06:00-07:00 il-central-1

  # Maintenance window — Tuesday 04:00-05:00 UTC = Tuesday 07:00-08:00 IL
  maintenance_window = "tue:04:00-tue:05:00"

  # Apply changes during the maintenance window unless flagged urgent
  apply_immediately = var.apply_immediately

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.slow.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "slow-log"
  }

  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.engine.name
    destination_type = "cloudwatch-logs"
    log_format       = "json"
    log_type         = "engine-log"
  }

  tags = local.default_tags
}

# Auth token (generated, not user-input — rotated by running `tofu taint`)
resource "random_password" "auth_token" {
  count   = var.auth_token_enabled ? 1 : 0
  length  = 64
  special = false # ElastiCache requires alnum + a few specials; alnum is safe
}

# Store the connection URL in Secrets Manager so the app can pull it
# via External Secrets the same way it pulls DB credentials.
resource "aws_secretsmanager_secret" "redis_url" {
  name        = "${local.name}/redis"
  description = "Resumaker Redis connection URL (managed by tofu)"

  tags = local.default_tags
}

resource "aws_secretsmanager_secret_version" "redis_url" {
  secret_id = aws_secretsmanager_secret.redis_url.id
  secret_string = jsonencode({
    url = var.auth_token_enabled ? format(
      "rediss://:%s@%s:6379",
      random_password.auth_token[0].result,
      aws_elasticache_replication_group.main.primary_endpoint_address,
      ) : format(
      "rediss://%s:6379",
      aws_elasticache_replication_group.main.primary_endpoint_address,
    )
    host  = aws_elasticache_replication_group.main.primary_endpoint_address
    port  = 6379
    token = var.auth_token_enabled ? random_password.auth_token[0].result : ""
  })
}

# CloudWatch log groups
resource "aws_cloudwatch_log_group" "slow" {
  name              = "/aws/elasticache/redis/${local.name}/slow"
  retention_in_days = var.log_retention_days
  tags              = local.default_tags
}

resource "aws_cloudwatch_log_group" "engine" {
  name              = "/aws/elasticache/redis/${local.name}/engine"
  retention_in_days = var.log_retention_days
  tags              = local.default_tags
}
