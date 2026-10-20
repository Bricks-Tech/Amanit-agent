# Amanit AWS setup (live in `us-east-2`)

## How it fits together

```text
Browser
  └─ CloudFront (web)  →  S3 (static React build)
  └─ App Runner (API)  →  RDS Postgres
ElevenLabs webhook     →  App Runner /webhooks/elevenlabs
```

| Piece | AWS resource | Purpose |
|-------|--------------|---------|
| Database | **RDS Postgres** `amanit-postgres` | Stores users, conversations, orders |
| Backend | **App Runner** `amanit-api` + **ECR** image | Express API; runs migrations on boot |
| Frontend | **S3** + **CloudFront** | Landing + admin dashboard |

Secrets and resource IDs for this account live in `infra/aws-resources.env` (gitignored).  
App code only reads `DATABASE_URL` / env vars — it never creates the RDS server.

## Live URLs (this account)

- **Web:** `https://d2wgeq1xqptyvn.cloudfront.net`
- **Admin login:** `https://d2wgeq1xqptyvn.cloudfront.net/login`
- **API:** `https://bxppcdpxki.us-east-2.awsapprunner.com`
- **Health:** `https://bxppcdpxki.us-east-2.awsapprunner.com/health`
- **Webhook:** `POST https://bxppcdpxki.us-east-2.awsapprunner.com/api/elevenlabs/webhook` (public, no secret)

Seeded staff user: `admin@amanit.com` / `admin123`

## What was created

1. RDS Postgres 16 (`db.t4g.micro`, public, DB name `amanit`)
2. Prisma migrations + seed applied to that RDS
3. ECR repo `amanit-api` + image pushed
4. App Runner service with `DATABASE_URL`, `JWT_SECRET`, `WEBHOOK_SECRET`, `CORS_ORIGIN`
5. S3 bucket `amanit-web-267811819907` + CloudFront distribution
6. Web build deployed with `VITE_API_URL` pointing at App Runner

## Redeploy

```bash
# API image
source infra/aws-resources.env
aws ecr get-login-password --region us-east-2 \
  | docker login --username AWS --password-stdin "$ECR_URI"
docker build -t "$ECR_URI:latest" apps/api
docker push "$ECR_URI:latest"
aws apprunner start-deployment --service-arn "$APPRUNNER_SERVICE_ARN"

# Web
VITE_API_URL="$API_URL" npm run build -w @amanit/web
aws s3 sync apps/web/dist "s3://$WEB_S3_BUCKET" --delete
aws cloudfront create-invalidation --distribution-id "$CLOUDFRONT_DISTRIBUTION_ID" --paths "/*"
```

GitHub Actions (`.github/workflows/deploy.yml`) can automate this once you add OIDC role + secrets (`AWS_ROLE_ARN`, `APPRUNNER_SERVICE_ARN`, `WEB_S3_BUCKET`, `CLOUDFRONT_DISTRIBUTION_ID`) and var `VITE_API_URL`.

## Local against RDS

`apps/api/.env` already points at the RDS `DATABASE_URL`.

```bash
npm run dev:api
npm run dev:web
```
