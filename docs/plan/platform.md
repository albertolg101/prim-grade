# Plan — platform build (PL-01–35)

Started 5 November 2026 on branch `feat/platform`. Spec: [`../spec/platform.md`](../spec/platform.md).
Stack: [ADR-0001](../adr/0001-platform-stack.md). Each task names its requirement ids, its output and
its test (D3). Ticks match commits.

## Tasks

| Id | Task | Covers | Output | Test |
|---|---|---|---|---|
| T01 | Grader: per-key LLM client, revise step | GL-01, GL-02 | `grader/llm.py` `openai_llm(key)`, `grader/setup.py` `revise_text` | `tests/test_grading.py` |
| T02 | Server skeleton: config, DB models, migration, compose `db` | ADR-0001 | `server/`, `docker-compose.yml` | `server/tests/conftest.py` (migration runs) |
| T03 | Accounts: sign-up, first admin, login, sessions, admin actions | PL-01–05 | `server/primgrade_server/routes/auth.py`, `admin.py` | `test_accounts.py` (AC-P01, AC-P02) |
| T04 | Settings: encrypted key, theme, link minutes | PL-06–08 | `routes/settings.py` | `test_settings.py` (AC-P03) |
| T05 | Files: pages and raw captures, checksums, owner checks | PL-12–14 | `files.py` | `test_files.py` (AC-P07) |
| T06 | Problems: drafts, generate, edit, improve, accept, versions | PL-15–19 | `routes/problems.py` | `test_problems.py` (AC-P04–06) |
| T07 | Answers: add, grade, review data, approve with AI feedback | PL-20–24 | `routes/answers.py` | `test_answers.py` (AC-P08, AC-P09) |
| T08 | Groups and exams | PL-25–27 | `routes/groups.py`, `exams.py` | `test_exams.py` (AC-P10) |
| T09 | Upload links, student page API, cookie binding | PL-28–31, PL-35 | `routes/exams.py` (links), `public.py` | `test_links.py` (AC-P11, AC-P12, AC-P15, AC-P16) |
| T10 | Cost records and views | PL-32–34 | `ai.py` (records), `routes/costs.py` | `test_costs.py` (AC-P13) |
| T11 | Web: Vite, Tailwind, shadcn/ui, theme, auth screens, tabs | PL-07, PL-09–11 | `web/` | `npm run build` |
| T12 | Web: capture (browse, drop, scan with jscanify) | PL-12–14 | `web/src/components/capture/` | build; browser check |
| T13 | Web: problems editor, improve, answers, review | PL-15–24 | `web/src/pages/` | build; browser check |
| T14 | Web: groups, exams, links + QR, student page, costs, admin, settings | PL-25–35 | `web/src/pages/` | build; browser check |
| T15 | Docker: api and web images, compose up | ADR-0001 | `Dockerfile`s | `docker compose up`, AC-P14 walk |

## Decisions log (D10: question, default applied, why)

- *Where do server tests get Postgres?* Default: the compose `db` service on port 5433, database
  `primgrade_test`, recreated per test session. The spec fixes PostgreSQL, and the PL-35 race
  check needs a real unique constraint.
- *Do student uploads start grading by themselves?* Default: no. The teacher starts grading
  (PL-21), so a link full of uploads does not spend tokens unasked (AGENTS.md: small runs).
- *Which version of a repeated student upload is graded?* Default: the newest, until the teacher
  picks another (PL-31).
- *PL-35 open points.* Defaults: the cookie lives 180 days and is scoped to `/api/public`. With no
  cookie (blocked), the submission is refused with a message to ask the teacher. A student fixes a
  misspelled name only through the teacher. No IP or device tracking.
- *Scanner library.* jscanify 1.4.3 (MIT, checked 5 November 2026) with its bundled `opencv.js`,
  vendored in `web/public/vendor/jscanify/` so the npm package's native `canvas` dependency is not
  installed.
- *Testing the UI without a key or spending tokens.* Default: `PRIMGRADE_LLM=fake` makes the server
  use a deterministic fake model. It is off by default, and the UI shows a banner while it is on.
- *Phone camera needs HTTPS.* Default for now: localhost works on the computer. For phones,
  `PUBLIC_BASE_URL` sets the address in the QR code, and HTTPS stays an open task (ADR-0001).
- *GL-04 (ignore instructions written on answers).* Not implemented: it needs owner approval.
- *Price file missing.* Default: the server refuses to start without a price for `gpt-6.1-sol`, so an
  unknown cost is never shown as $0 (PL-32). Found in the browser walk on 5 November 2026.
- *No live camera (plain HTTP, or permission refused).* Default: *Scan* falls back to the phone's own
  camera app (`capture="environment"`) and still detects and straightens the page.
- *Student page after a refusal.* Open: the pages picked before a PL-35 refusal stay on the page and
  are sent with the next submission from that browser. Default for now: unchanged, since the student
  sees every page before sending (PL-29). Candidate for the first simulated-user wave.

## Resume point

Updated 5 November 2026: T01–T15 done. 54 tests pass (grader + server on PostgreSQL); `npm run build`
passes; `docker compose up --build` serves the app on :8080. Browser walk with the fake model at
375 px and 1280 px, light and dark: sign-up, problem setup, improve/discard, accept, answers, grading,
review, approval with AI verdict, exam + group, link with QR, student upload, PL-35 refusal, scanner
corners (synthetic photo; the pane has no camera). Not done: a real phone camera on HTTPS, a real-model
run (needs the owner's key; at most 5 answers), and the D9 simulated-user wave. Next: run wave 1 with
`tools/wave/` against http://localhost:8080.
