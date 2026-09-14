# Handoff

A Flow Builder application ("Handoff") that takes an Engagement Director from opportunity
handoff to an approved delivery plan: guided intake (modeled on Manhattan Associates'
Sales Transition meeting document) → deterministic classification → deterministic
estimation (ported from the Burn Plan Calculator reference prototype) → scenario
comparison → approval workflow → kickoff/pre-kickoff artifact generation.

This is a greenfield build — the repository had no prior code, so the stack and
conventions below were chosen rather than discovered.

## Stack

- **Next.js 14 (App Router) + TypeScript (strict)** — UI and API routes in one app
- **Prisma + SQLite** for local dev (swap `DATABASE_URL` for Postgres in a shared environment;
  every field is Prisma-portable — SQLite just has no native enum type, so enum-shaped
  fields are `String` with the allowed values documented in `src/lib/enums.ts` and
  validated with Zod at every API boundary)
- **NextAuth (Credentials provider)** + a `roles` JSON column for RBAC
- **Zod** at every service boundary
- **ExcelJS** for the Approved Burn Plan workbook export
- **Vitest** for unit + integration tests

## Setup

```bash
npm install
cp .env.example .env        # edit NEXTAUTH_SECRET to a random 32-byte value
npx prisma generate
npx prisma migrate dev --name init   # creates prisma/dev.db and applies the schema
npm run prisma:seed         # seeds users, question set, published template, sample transition
npm run dev                 # http://localhost:3000
```

Seeded accounts (password `password123` for all — **local dev only**):

| Email | Role |
|---|---|
| `alex.director@example.com` | Transition Owner / Contributor (Engagement Director) |
| `sam.sponsor@example.com` | Executive Approver |
| `tim.templates@example.com` | Template Owner |
| `admin@example.com` | Administrator |
| `pat.sales@example.com` | Contributor (Sales Lead) |

## Environment variables

See `.env.example`. Notable ones:

- `DATABASE_URL` — SQLite file path locally; a Postgres connection string in a shared environment.
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — required by NextAuth.
- `TRANSCRIPTION_PROVIDER` — `mock` (default) or a real provider once one is wired up (see below).
- `FLOWBUILDER_BASE_URL` / `FLOWBUILDER_API_KEY` — when unset, the Flow Builder adapter
  logs events to the console instead of calling a real Flow Builder endpoint.
- `RETAIN_RAW_AUDIO` — `false` by default; raw transcripts are never persisted unless this is
  explicitly set to `true`.

## Commands

```bash
npm run dev                    # dev server
npm run build && npm start     # production build/run
npm run typecheck              # tsc --noEmit
npm run lint                   # next lint
npm test                       # unit tests (domain layer, 52 tests)
npm run test:integration:setup # creates/migrates prisma/test.db
npm run test:integration       # integration tests against a real SQLite DB (5 tests)
npx prisma studio              # inspect the local database
```

**Test results as of this build:** 52/52 unit tests + 5/5 integration tests passing.
The unit suite includes 10 calculator-parity tests: the ported estimation engine was
verified against ground truth computed by extracting the reference calculator's own
pure computation and running it in Node against the same baseline data, across
baseline, contingency, all three holiday-treatment modes, resource multipliers, phase/
product adjustments, and manual role-hour overrides. The full vertical slice (create
transition → intake → classify → generate plan → submit → approve → lock → generate
Excel + kickoff artifacts) was also exercised end-to-end against the running dev server
via the real HTTP API during development.

## Repository layout

```
prisma/schema.prisma              Domain model (see below)
prisma/seed.ts                    DEV FIXTURE — users, question set, published template
src/domain/                       Pure, framework-free business logic (all unit-tested)
  estimation/                     Deterministic calculation engine ported from the calculator
  intake/                         Question visibility rules, answer normalization, validation
  classification/                 Deterministic engagement classification + explainability
  templates/                      Template Draft→Review→Published→Retired lifecycle
  versioning/                     Plan version state machine, scenario cloning/comparison
  approval/                       Submission/approval guards, approval decisions
  artifacts/                      Artifact document builders + Excel workbook builder
src/adapters/
  transcription/                  TranscriptionProvider interface + local mock
  flowbuilder/                    FlowBuilderAdapter interface + console/mock + HTTP impl
src/lib/                          db (Prisma singleton), auth, rbac, session, audit, enums
src/server/                       Route-facing helpers: schemas (Zod), plan generation,
                                   intake answer loading, artifact storage, error mapping
src/app/api/                      REST-ish API routes (the service boundary)
src/app/(app)/                    Authenticated UI: transitions, templates, approvals, admin
tests/integration/                Integration tests against a real migrated SQLite DB
```

## Notes on the current model

- **Engagement Director / Sales Lead / Executive Sponsor** are free-text names on a
  project, not tied to a login — login/approval access is managed at the Flow Builder
  level, not per-field here. Approval requests are role-based, not bound to a specific
  account: any signed-in user with approval access can act on a pending request, and the
  acting user is recorded on the decision.
- **Plan type** is Single site or Multi-site only.
- **Documents**: a project can have local file uploads and SharePoint links attached
  (`ProjectDocument`, stored under `project-documents/`, gitignored). They're stored and
  shown for reference only — nothing is auto-extracted into intake answers yet, and
  nothing crawls the linked SharePoint folder (no Graph API credentials are configured).
- **Intake question set** is modeled on Manhattan Associates' Sales Cycle / Sales
  Transition handoff meeting document — see the `QUESTIONS` array in `prisma/seed.ts`.

## Domain model

See `prisma/schema.prisma`. Core entities: `User`, `Client`, `Transition`,
`QuestionDefinition`, `IntakeAnswer`, `Classification`, `Template`, `PlanVersion`,
`Phase`, `RoleAllocation`, `Assumption`/`Risk`/`Decision`, `Approval`, `ArtifactJob`,
`AuditEvent`. `PlanVersion` stores `templateSnapshot`, `inputSnapshot`, and
`calculationSnapshot` as JSON so historical plans stay reproducible even after templates
are edited or republished — publishing a template never touches an existing plan.

## How the pieces fit together (vertical slice)

1. **Create Transition** (`POST /api/transitions`) — client/opportunity, owner, sponsor,
   plan type, initial products.
2. **Complete Intake** (`/transitions/:id/intake`) — step-based interview grouped into the
   seven domains from the spec, with conditional visibility (`src/domain/intake/visibility.ts`),
   text and microphone input (browser Web Speech API → editable transcript →
   `POST /api/transitions/:id/answers`, normalized server-side), and explicit confirmation
   for high-impact fields.
3. **Classify** (`POST /api/transitions/:id/classify`) — deterministic, explainable
   (`src/domain/classification/service.ts`); every field cites the answers it came from.
4. **Generate Plan** (`POST /api/transitions/:id/plan`) — selects the applicable Published
   `PLAN_TEMPLATE`, merges it with intake-derived inputs, runs the estimation engine, and
   persists a `PlanVersion` with a full calculation trace.
5. **Scenarios** (`/transitions/:id/scenarios`, `POST /api/plan-versions/:id/scenarios`) —
   clone into a new linked version, compare deltas, mark one recommended.
6. **Review & Approval** (`/transitions/:id/review`) — submit (guarded — see below),
   executive approves/rejects/requests changes; approval locks the plan
   (`src/domain/versioning/stateMachine.ts`).
7. **Outputs** (`/transitions/:id/outputs`) — generate the five required artifacts;
   the Excel export is blocked until the plan is actually `APPROVED`
   (`assertArtifactGenerationAllowed`), and every artifact carries transition id, plan
   version id, timestamp, Draft/Approved status, template version, and prepared-by.

## Non-negotiables, and where they're enforced

- **Deterministic estimates** — `src/domain/estimation/engine.ts` is a pure function; the
  UI never lets an LLM produce hours/dates/rates/totals. 10 parity tests pin its output
  against the reference calculator.
- **AI stays assistive, not authoritative** — the transcription adapter turns speech into
  an *editable* transcript; nothing is written to an answer until the user confirms it
  (`isConfirmed`), and `src/domain/intake/service.ts#unresolvedHighImpactQuestions` blocks
  submission on unconfirmed high-impact fields.
- **Explainability** — `EstimationResult.trace` and `ClassificationResult.reasons` are
  returned alongside every generated plan/classification and rendered in the UI
  ("Why this number?" panel, classification reasons list).
- **Templates are governed** — nothing plan-type/phase/role/assumption-shaped is
  hardcoded in a component; it all comes from a `PUBLISHED` `Template.body`, and
  publishing creates a new immutable version (`src/domain/templates/service.ts`).
- **Approved plans are immutable** — `assertVersionIsEditable` blocks in-place PATCHes
  on an `APPROVED`/`SUPERSEDED`/`ARCHIVED` version; verified live (see test results above).
- **Client data protection** — raw transcripts are only persisted if
  `RETAIN_RAW_AUDIO=true`; RBAC is enforced server-side in every route
  (`src/lib/rbac.ts#requireRole`), not just hidden in the UI.
- **Extension points** — `TranscriptionProvider` and `FlowBuilderAdapter` are typed
  interfaces with local mock implementations; nothing in the UI or domain layer calls a
  vendor SDK directly.

## Implemented vs. mocked integrations

| Integration | Status |
|---|---|
| Estimation engine | **Real** — deterministic, parity-tested against the reference calculator |
| Classification | **Real** — deterministic, rule-based, explainable |
| Auth / RBAC | **Real** — NextAuth Credentials + server-side role checks |
| Template registry lifecycle | **Real** — Draft/Review/Published/Retired enforced |
| Approval workflow / locking | **Real** — full state machine, verified end-to-end |
| Artifact generation (Excel + 4 markdown docs) | **Real** — generated from the actual calculation result, stored on local disk (`artifact-storage/`, gitignored) |
| Speech-to-text | **Mocked** — browser Web Speech API client-side (real dictation in Chrome/Edge); `TranscriptionProvider` interface ready for a server-side vendor (e.g. a cloud STT API) — swap `getTranscriptionProvider()` |
| Flow Builder events | **Mocked** — `ConsoleFlowBuilderAdapter` logs `transition.created` / `intake.completed` / `plan.generated` / `plan.submitted_for_approval` / `plan.approved` / `artifacts.generated`; `HttpFlowBuilderAdapter` is implemented and activates automatically once `FLOWBUILDER_BASE_URL`/`FLOWBUILDER_API_KEY` are set |
| Artifact file storage | **Local filesystem** (`src/server/artifactStorage.ts`) — swap for Flow Builder's blob storage in a real deployment; `ArtifactJob.fileReference` is storage-agnostic |
| E2E browser tests (Playwright) | **Not implemented** — the full flow was instead verified via direct HTTP calls against the running dev server (see Test results above) and via `next build`'s static/type checks |

## Known limitations

- The estimate screen's role-detail editor shows the first 16 working weeks per
  workstream (not a full scrolling multi-year Gantt like the reference prototype) —
  functionally complete (edits recalculate everything), visually simplified.
- Template administration UI is read-only (list view); the domain service and API routes
  for create/clone/publish/retire are implemented and tested, but there's no admin form
  yet to drive them — use the API directly or extend `/templates`.
- No Playwright/browser E2E suite; the flow was verified via API-level integration
  instead. Adding Playwright against the seeded fixtures would be the natural next step.
- Classification thresholds (`src/domain/classification/rules.ts`) are a sensible
  default, not a governed `COMPLEXITY_FACTORS` template row yet — the type is designed so
  that wiring it to a real template later is a small change, not a rewrite.
- Multi-tenant client data isolation relies on standard row scoping (`transitionId`
  foreign keys); there's no separate tenant/schema partitioning, since none exists to
  match yet.

## Recommended next steps

1. Wire a real speech-to-text vendor behind `TranscriptionProvider`.
2. Connect `HttpFlowBuilderAdapter` to a real Flow Builder endpoint and confirm the six
   event payloads match what downstream consumers expect.
3. Build the Template Administration UI (create/clone/publish/retire, diff two versions)
   on top of the existing, tested `src/domain/templates` service and `/api/templates*` routes.
4. Add a Playwright E2E suite covering the 13-step flow in the original spec.
5. Move `DATABASE_URL` to Postgres and run `prisma migrate deploy` in the target
   environment; re-enable native enum columns if the target DB supports them (optional —
   the String + Zod approach works identically on Postgres).
