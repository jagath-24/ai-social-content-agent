# Signal — AI Social Media Content Agent

Signal is a human-in-the-loop social media content studio. It turns one topic into three draft directions, keeps editing and approval in the middle, and schedules only the posts a person has explicitly approved. The default publishing mode is a safe simulation: due posts are marked `published` and counted as `used`, but no external network is contacted.

## What is included

| Capability | Implementation |
| --- | --- |
| Content generation | Groq-compatible LLaMA call when `GROQ_API_KEY` is present; built-in server-side LLM or local template fallback when it is not |
| Approval queue | React dashboard with inline editing, approve, reject, and status badges |
| Scheduling | Approved posts can receive a UTC timestamp; a Heartbeat-compatible callback publishes due rows idempotently |
| Calendar | Calendar view grouped by scheduled date with scheduled and simulated-published states |
| Preference learning | Counts used posts by tone and surfaces the most-used tone; this is not engagement analytics |
| API | REST routes matching the brief plus typed tRPC procedures used by the UI |
| Auth and persistence | Manus OAuth scaffold with MySQL/TiDB through Drizzle ORM |

## Run locally with Docker Compose

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`. The local MySQL service uses database `signal`, user `signal`, and password `signal`. The compose file intentionally uses a development-only JWT secret; replace it for any shared environment. To use Groq, export `GROQ_API_KEY` before starting the stack. Without it, Signal still works with the built-in server-side model and a deterministic template fallback.

For the managed project scaffold, install dependencies and run the app with:

```bash
pnpm install
pnpm db:push
pnpm dev
```

## REST API

The REST routes authenticate through the existing session cookie or preview bearer fallback.

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/content/generate` | Generate and persist three variants. Body: `{ "topic": "..." }` |
| `GET` | `/api/content/queue` | Return the authenticated user's active queue |
| `PUT` | `/api/content/:id/approve` | Approve a draft. Optional body: `{ "body": "edited copy" }` |
| `POST` | `/api/content/:id/schedule` | Schedule an approved post. Body: `{ "scheduledAt": "2026-09-20T14:00:00.000Z" }` |
| `GET` | `/api/content/calendar` | Return scheduled and published content |
| `GET` | `/api/content/analytics` | Return simulated preference counts |
| `POST` | `/api/scheduled/publish-due` | Heartbeat-only callback that marks due scheduled rows as published |

The dashboard consumes equivalent typed tRPC procedures under `/api/trpc`.

## Scheduler setup

No in-process timer is used because managed serverless instances can stop between requests. The scheduled callback is mounted at `/api/scheduled/publish-due` and is safe to retry: it only updates rows that are still `scheduled` and whose timestamp is due.

After deploying the site, create a project-level Heartbeat job against the production URL using the platform's scheduler tooling. The cron expression is six-field UTC with seconds, for example every five minutes:

```bash
manus-heartbeat create \
  --name signal-publish-due \
  --cron "0 */5 * * * *" \
  --path /api/scheduled/publish-due \
  --description "Mark approved Signal posts as published when their scheduled time arrives"
```

The platform authenticates cron calls and supplies a cron identity. The handler rejects regular user sessions with `403 cron-only`, so the publish path cannot be triggered accidentally from the browser. The dashboard's **Run scheduler** button is a safe authenticated demo action for local testing and does not replace the production Heartbeat job.

## Optional live platform integration

The current implementation deliberately stops at simulated publishing. A real LinkedIn or X adapter can be added inside `runDuePublications()` after the human approval boundary. Keep the adapter behind a server-side secret, record the provider response and remote post ID, and preserve idempotency so a retried callback cannot publish the same row twice.

## Project structure

```text
client/src/pages/Home.tsx       approval studio and generation flow
client/src/pages/Calendar.tsx   content calendar
client/src/components/          responsive Signal shell
server/content.ts               domain logic and optional Groq integration
server/routers.ts               typed tRPC procedures
server/_core/index.ts           REST routes and scheduled callback
drizzle/schema.ts               users and contentItems tables
docker-compose.yml              local MySQL + app
```

## Validation

```bash
pnpm check
pnpm test
pnpm build
```

The migration for `contentItems` is generated under `drizzle/` and applied to the managed database during implementation. No seed data is inserted by the migration; first-run content is created through the UI or API.
