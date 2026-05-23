/**
 * RDS Postgres module.
 *
 * Provisions a Postgres instance + parameter group + subnet group +
 * security group. Defaults are dev-friendly; pass overrides for prod
 * (multi_az, larger instance, longer backup retention).
 */

locals {
  name_prefix = "${var.project}-${var.environment}"
}

# ─── Security group ───
resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-rds"
  description = "Postgres access for ${local.name_prefix}"
  vpc_id      = var.vpc_id

  ingress {
    description     = "Postgres from app SG"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = var.app_security_group_ids
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${local.name_prefix}-rds"
  }
}

# ─── Subnet group (private subnets only) ───
resource "aws_db_subnet_group" "main" {
  name       = "${local.name_prefix}-rds"
  subnet_ids = var.private_subnet_ids

  tags = {
    Name = "${local.name_prefix}-rds-subnets"
  }
}

# ─── Parameter group ───
resource "aws_db_parameter_group" "main" {
  name        = "${local.name_prefix}-pg17"
  family      = "postgres17"
  description = "Resumaker tuned parameter group"

  parameter {
    name  = "log_min_duration_statement"
    value = "500" # log slow queries (ms)
  }

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  parameter {
    name  = "log_statement"
    value = "ddl"
  }
}

# ─── Password (auto-generated, stored in Secrets Manager) ───
resource "random_password" "master" {
  length  = 32
  special = false # avoid URL-special chars
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name        = "${local.name_prefix}/db-credentials"
  description = "Postgres master credentials for ${local.name_prefix}"
  # Force recreation when name changes
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.master_username
    password = random_password.master.result
    host     = aws_db_instance.main.address
    port     = 5432
    database = var.database_name
    url      = "postgres://${var.master_username}:${random_password.master.result}@${aws_db_instance.main.endpoint}/${var.database_name}?sslmode=require"
  })
}

# ─── The instance ───
resource "aws_db_instance" "main" {
  identifier = "${local.name_prefix}-db"

  engine                = "postgres"
  engine_version        = var.engine_version
  instance_class        = var.instance_class
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.database_name
  username = var.master_username
  password = random_password.master.result
  port     = 5432

  vpc_security_group_ids = [aws_security_group.db.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  parameter_group_name   = aws_db_parameter_group.main.name

  publicly_accessible = false
  multi_az            = var.multi_az
  deletion_protection = var.deletion_protection

  backup_retention_period   = var.backup_retention_days
  backup_window             = "03:00-04:00"
  maintenance_window        = "Sun:04:00-Sun:05:00"
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${local.name_prefix}-final-${formatdate("YYYYMMDDhhmmss", timestamp())}"

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  performance_insights_enabled          = var.performance_insights_enabled
  performance_insights_retention_period = var.performance_insights_enabled ? 7 : null

  tags = {
    Name = "${local.name_prefix}-db"
  }

  # timestamp() in final_snapshot_identifier forces drift; suppress
  lifecycle {
    ignore_changes = [final_snapshot_identifier]
  }
}
