# ADR-0001: Platform stack

Status: accepted for the owner's fixed choices; proposed for the rest. Date: 5 November 2026.
Spec: [`docs/spec/platform.md`](../spec/platform.md).

## Context

The platform wraps the Python grading library `grader/`, which must stay separate from the
product (AGENTS.md, Grader library boundary). On 5 November 2026 the owner fixed four choices:
a PostgreSQL relational database, Docker support, shadcn/ui as the design system, and OpenAI
`gpt-6.1-sol` for every AI call. The app must work on phones and computers and needs a camera
document scanner.

## Decision

Fixed by the owner:

- **Database:** PostgreSQL.
- **Run:** Docker. `docker compose up` starts the database, the API and the web app.
- **Design system:** shadcn/ui (React with Tailwind CSS), with theme tokens for dark (yellow
  primary) and light (blue primary).
- **Model:** `gpt-6.1-sol` for setup, revision and grading (PL-34).

Proposed defaults (change by a new ADR):

- **API:** Python with FastAPI, so it calls `grader/` in-process. SQLAlchemy models and Alembic
  migrations.
- **Web:** React and TypeScript with Vite, shadcn/ui components, mobile-first layout.
- **Folders:** `server/` (API, its own tests) and `web/` (UI) at the top level, next to `grader/`.
  `grader/` never imports from them.
- **Files:** originals, raw captures and scanned pages are stored on a Docker volume, never
  modified. PostgreSQL holds their metadata and checksums.
- **Auth:** email and password (argon2 hashes), session in an httpOnly cookie.
- **API keys:** encrypted at rest with a server secret from the environment, decrypted only to
  make a call.
- **Scanner:** a client-side document-detection library on OpenCV.js. The candidate is jscanify;
  its licence and phone performance are checked before adoption.
- **Background grading:** runs in the API process with a bounded concurrency, as the prototype
  did; a job queue only when it measurably falls short.

## Consequences

- One `docker compose` file runs everything locally; there is no deployment target yet.
- A Python API keeps the grader in-process and avoids a second service boundary.
- In-process grading is lost if the API restarts mid-batch. Runs left in *running* are shown as
  *failed* on restart (I2) and can be run again.
- Phone camera access needs HTTPS outside localhost. The QR link (PL-28) therefore needs an HTTPS
  address reachable from students' phones. How to provide one locally is an open task.
