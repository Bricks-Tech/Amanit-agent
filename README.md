# Amanit Voice Concierge

Monorepo for the Amanit voice landing page, staff dashboard (conversations + orders), and API.

```text
apps/
  web/   # Vite + React (landing, login, dashboard)
  api/   # Express + Prisma + Postgres
```

Agent ID: `agent_2401m2tcwarpf8598fxz7zyk34zc`

## Database (AWS RDS)

The app **does not create** the database server. You create **Postgres on AWS RDS**, then set:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@YOUR_RDS_ENDPOINT:5432/amanit?sslmode=require
```

in `apps/api/.env` (local) and on App Runner / Secrets Manager (production).

Prisma migrations create the tables on that RDS instance (`npm run db:migrate -w @amanit/api`). Details: [infra/aws.md](infra/aws.md).

`docker-compose.yml` is optional local-only Postgres if you are not using RDS yet.

## Prerequisites

- Node.js 22+
- AWS RDS Postgres credentials (or optional Docker for local DB)

## Local setup

```bash
# install workspaces
npm install

# api env — paste your RDS DATABASE_URL
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# create tables + seed admin on that database
npm run db:migrate -w @amanit/api
npm run db:seed -w @amanit/api

# run API and web (two terminals)
npm run dev:api
npm run dev:web
```

- Site: [http://localhost:5173](http://localhost:5173)
- Dashboard login: [http://localhost:5173/login](http://localhost:5173/login)
- Default staff: `admin@amanit.com` / `admin123`
- API health: [http://localhost:4000/health](http://localhost:4000/health)

Add `http://localhost:5173` to the ElevenLabs agent allowed origins. Production needs HTTPS.

## API surface

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/auth/login` | no | Staff login |
| GET | `/conversations` | yes | List conversations |
| GET | `/orders` | yes | List orders |
| PATCH | `/orders/:id` | yes | Update order status |
| POST | `/webhooks/elevenlabs` | no | Ingest post-call data |

## Deploy on AWS

CI lives in [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

- **Web** → S3 + CloudFront
- **API** → ECR + App Runner (+ RDS Postgres)

See [infra/aws.md](infra/aws.md) for the one-time AWS setup and GitHub secrets.

## Optional: Vercel for web only

`apps/web` can still deploy to Vercel. Point `VITE_API_URL` at the App Runner API URL and keep CORS aligned.
