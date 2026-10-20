#!/usr/bin/env bash
# Idempotent helpers for Amanit AWS bootstrap (us-east-2).
# Secrets live in infra/aws-resources.env (gitignored).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/infra/aws-resources.env"
export AWS_DEFAULT_REGION="${AWS_REGION:-us-east-2}"

echo "Region=$AWS_DEFAULT_REGION Account=$AWS_ACCOUNT"
echo "RDS=$RDS_INSTANCE_ID ECR=$ECR_URI Bucket=$WEB_S3_BUCKET"
