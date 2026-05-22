#!/usr/bin/env bash
# Bootstrap OpenTofu state backend
# Run this ONCE before any 'tofu init' command works.

set -euo pipefail

# Config
BUCKET_NAME="resumaker-tofu-state"
DDB_TABLE="resumaker-tofu-locks"
REGION="us-east-1"
PROFILE="${AWS_PROFILE:-resumaker}"

echo "🚀 Bootstrapping OpenTofu state backend"
echo "   Bucket: $BUCKET_NAME"
echo "   Lock table: $DDB_TABLE"
echo "   Region: $REGION"
echo "   Profile: $PROFILE"
echo ""

# Verify auth works
echo "▶ Verifying AWS auth..."
aws sts get-caller-identity --profile "$PROFILE" >/dev/null
echo "✅ Auth OK"

# Create S3 bucket
if aws s3api head-bucket --bucket "$BUCKET_NAME" --profile "$PROFILE" 2>/dev/null; then
  echo "✅ Bucket already exists"
else
  echo "▶ Creating S3 bucket..."
  aws s3api create-bucket \
    --bucket "$BUCKET_NAME" \
    --region "$REGION" \
    --profile "$PROFILE"
  echo "✅ Bucket created"
fi

# Enable versioning
echo "▶ Enabling versioning..."
aws s3api put-bucket-versioning \
  --bucket "$BUCKET_NAME" \
  --versioning-configuration Status=Enabled \
  --profile "$PROFILE"

# Enable encryption
echo "▶ Enabling encryption..."
aws s3api put-bucket-encryption \
  --bucket "$BUCKET_NAME" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      }
    }]
  }' \
  --profile "$PROFILE"

# Block public access
echo "▶ Blocking public access..."
aws s3api put-public-access-block \
  --bucket "$BUCKET_NAME" \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  --profile "$PROFILE"

# Create DynamoDB lock table
if aws dynamodb describe-table --table-name "$DDB_TABLE" --region "$REGION" --profile "$PROFILE" >/dev/null 2>&1; then
  echo "✅ Lock table already exists"
else
  echo "▶ Creating DynamoDB lock table..."
  aws dynamodb create-table \
    --table-name "$DDB_TABLE" \
    --attribute-definitions AttributeName=LockID,AttributeType=S \
    --key-schema AttributeName=LockID,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION" \
    --profile "$PROFILE"

  echo "▶ Waiting for table to be active..."
  aws dynamodb wait table-exists \
    --table-name "$DDB_TABLE" \
    --region "$REGION" \
    --profile "$PROFILE"
  echo "✅ Lock table created"
fi

echo ""
echo "✅ Bootstrap complete!"
echo ""
echo "Next steps:"
echo "  cd infra/tofu/environments/dev"
echo "  tofu init"
