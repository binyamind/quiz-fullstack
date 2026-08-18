# Frontend design — Next.js 15 school portal

Status: approved 2026-08-18. Implements the Frontend column of SPECS.md
against the Fastify API in `apps/api`, which is complete and covered at 100%.

## Context

The API exposes the whole product surface already: role-scoped CRUD for users,
teacher groups, classes, assignments and submissions; the six statistics
endpoints; JWT auth in HTTP-only cookies with GitHub OAuth; and a chatbot
grounded in per-user context. Nothing in this design requires an API change.

Two constraints shape every decision below:

- **No data-fetching library.** The locked dependency list has neither React
  Query nor SWR, so client-side fetching would mean hand-rolling caching,
  revalidation and request dedup on every screen.
- **Auth is HTTP-only cookies.** The browser cannot read them, so the session
  can only be handled where cookies are: on the server.

## Architecture

`apps/web` runs Next 15 (App Router) on `:3000` as a backend-for-frontend.

### The proxy

`app/api/v0/[...path]/route.ts` proxies every method to Fastify, forwarding the
request body and `cookie` header, and passing `Set-Cookie` back untouched.
Fastify's login and refresh responses therefore land on the browser as
same-origin cookies for `:3000`.

Consequences:

- CORS is irrelevant in production; the browser only ever talks to `:3000`.
- The Fastify address stays a server-side `API_URL` env var. No `NEXT_PUBLIC_*`.
- The API's cookie path scoping survives — the refresh cookie stays scoped to
  `/api/v0/auth`.
- In deployment, Fastify need not be exposed publicly at all.

### Reads

Server Components call Fastify through one `apiFetch()` helper that pulls the
cookie from `next/headers` and forwards it. No client-side fetching and no
data library: the component awaits its data. Status codes map to `notFound()`,
`redirect()` or a thrown error for the nearest error boundary.

### Writes

Server Actions post to Fastify and then call `revalidatePath()`, so the affected
Server Components re-render against fresh data. Forms use `useActionState` for
pending and error state. There is no client cache to invalidate by hand.

### Token refresh

Server Components cannot set cookies in Next 15, so an expiring 15-minute access
token cannot be refreshed during render. `middleware.ts` owns this: on each
request, if the access cookie is absent but a refresh cookie is present, it calls
`/auth/refresh` and attaches the rotated `Set-Cookie` to the response before the
page renders.

```
request → middleware ─┬─ access ok ────────────→ render
                      ├─ expired + refresh ok ──→ set-cookie, render
                      └─ neither ───────────────→ redirect /login

RSC ──── apiFetch(cookie) ─────→ Fastify :4000
action ─ POST + revalidatePath ─→ Fastify :4000
```

Refresh living in exactly one place is the main reason this design was chosen
over fetching reads on the server and writing from the browser, which would
need the same rotation logic twice.

## Route tree

```
app/
  layout.tsx                    root: fonts, theme, Toaster
  middleware.ts                 auth + refresh + role gate

  (auth)/
    login/page.tsx              password form + "Sign in with GitHub"

  (admin)/admin/
    layout.tsx                  asserts role=admin
    page.tsx                    school overview — reads /stats/*
    users/page.tsx              list: search, role + suspended filters
    users/[id]/page.tsx         edit, reset password, suspend/unsuspend
    groups/page.tsx             teacher groups list + create
    groups/[id]/page.tsx        rename, delete, add/remove members

  (teacher)/teach/
    layout.tsx                  asserts role in {teacher, admin}
    page.tsx                    my classes
    classes/[id]/page.tsx       roster + assignments, add/remove students
    classes/[id]/assignments/new/page.tsx
    assignments/[id]/page.tsx   edit, publish, submissions table
    submissions/[id]/page.tsx   grade + feedback

  (student)/my/
    layout.tsx                  asserts role=student
    page.tsx                    enrolled classes + what's due
    work/page.tsx               assignments, published-only
    work/[id]/page.tsx          brief, submit/edit, grade + feedback
```

`/` redirects to `/admin`, `/teach` or `/my` by role — one place decides where a
signed-in user belongs. Unauthenticated requests redirect to `/login`; a
wrong-role request redirects to that user's own home rather than rendering an
empty screen.

Admins reach teaching screens through `/teach` rather than duplicated admin
copies, mirroring the API, whose `requireClassTeacher` hook already admits them.

### SPECS.md coverage

| Role | Requirement | Screen |
|---|---|---|
| Admin | teacher groups CRUD | `/admin/groups`, `/admin/groups/[id]` |
| Admin | user CRUD | `/admin/users`, `/admin/users/[id]` |
| Admin | suspend/unsuspend teachers and students | row action + detail toggle |
| Teacher | class CRUD | `/teach`, `/teach/classes/[id]` |
| Teacher | add/remove students | roster panel on the class page |
| Teacher | publish assignments | `/teach/assignments/[id]` |
| Teacher | grade + feedback | `/teach/submissions/[id]` |
| Student | view classes and assignments | `/my`, `/my/work` |
| Student | submit assignments | `/my/work/[id]` |
| Student | view grades and feedback | `/my/work/[id]` after grading |

The chatbot is a slide-over panel in the topbar, available on every
authenticated route rather than at its own URL, because it is about the page the
user is on.

## Shell

Persistent left sidebar with role-filtered items, topbar carrying the user menu
and the chat trigger.

```
┌────────┬───────────────────────────┐
│ Portal │  Classes      💬  👤 Tina  │
├────────┼───────────────────────────┤
│ Home   │                            │
│ Classes│   ┌────────┐ ┌────────┐  │
│ Work   │   │ Physics│ │ Latin  │  │
│ Users  │   │ 24 stu │ │ 18 stu │  │
│ Groups │   └────────┘ └────────┘  │
└────────┴───────────────────────────┘
```

## Module structure

```
apps/web/src/
  lib/
    api.ts          apiFetch(): cookie forwarding, status → error mapping
    session.ts      getSession(): /auth/me, cached per request
    schemas.ts      zod schemas for the forms
    format.ts       dates, grade display
  actions/
    auth.ts users.ts groups.ts classes.ts assignments.ts submissions.ts
  components/
    ui/             shadcn primitives over the existing Radix dependencies
    shell/          Sidebar, Topbar, RoleNav, UserMenu
    data/           DataTable, Pagination, EmptyState, StatusBadge
    forms/          fields wired to useActionState, field-level errors
    chat/           ChatPanel
  app/              routes only
```

**`app/**` contains no logic.** A page reads its params, calls one `lib/`
function and renders components. Every branch, format decision and error path
lives in a tested module. This is what makes the coverage boundary below honest
rather than a dodge; a page accumulating conditionals is a signal that logic
belongs in `lib/`.

`apiFetch` is the deepest module: callers get `apiFetch<T>(path, options)` and
either a typed result or a thrown mapped error. Cookie forwarding, base URL
resolution, JSON handling and the API's `{ error: { code, message } }` envelope
all stay inside it.

### Validation

The API is the source of truth and already returns per-field `VALIDATION_ERROR`
details. The web app keeps small zod schemas in `lib/schemas.ts` for immediate
client feedback, which duplicates a few rules such as `grade <= maxGrade`. A
shared `packages/schemas` workspace would remove the duplication at the cost of
another build target and cross-workspace type wiring, which is not worth it for
a handful of forms. Server errors always win: any API 400 renders onto the
offending field, so the two cannot silently disagree.

## Testing

React Testing Library cannot render async Server Components. That fact, not
convenience, determines the split:

| Layer | Tested by | Rationale |
|---|---|---|
| `lib/*` | Vitest unit, `fetch` mocked | Pure functions, every branch reachable |
| `actions/*` | Vitest unit, `apiFetch` + `revalidatePath` mocked | Plain async functions |
| `middleware.ts` | Vitest unit, `NextRequest` → `NextResponse` | The refresh logic; highest-risk code here |
| Client components | RTL + user-event, jsdom | Real interactivity |
| Server Components, pages | Playwright | Cannot be unit tested; covered as journeys |

`vitest.workspace.ts` defines two projects: the existing `api` project (node
env, unchanged) and a new `web` project (jsdom, `@testing-library/jest-dom` in
setup). Coverage stays configured at the root so one 100% gate spans both
workspaces, with `apps/web/src/app/**` excluded as thin shells — the same
treatment `server.ts` and the CLIs already get on the API side.

### End-to-end journeys

Run against the Compose stack seeded by the existing `npm run seed:demo`, which
provisions one admin, two teachers and two students.

1. **Admin** — log in, create a teacher, suspend a student, confirm the
   suspended user cannot log in, build a teacher group.
2. **Teacher** — create a class, enrol a student, write and publish an
   assignment, grade a submission with feedback.
3. **Student** — log in, see the published assignment and not the draft, submit,
   then see the grade and feedback.

Journeys 2 and 3 interlock deliberately: the teacher grades what the student
submitted, exercising the full loop rather than three isolated smoke tests.

## Containerisation and CI

The root Dockerfile gains the `web` target it already anticipates, built on
Next's `output: 'standalone'` so the runtime image carries only the server
bundle and its traced dependencies.

```
deps ──┬──→ build-api ──→ api
       └──→ build-web ──→ web
```

`API_URL` must be read at runtime, not baked at build time: it is
`http://localhost:4000` locally and `http://api:4000` in Compose. It is only
ever read server-side, so this is straightforward.

Compose gains a `web` service on `:3000` with `depends_on: api` health-gated,
and Next exposes `/api/health` so its healthcheck is real.

CI grows from two jobs to three:

```
verify ──→ docker (builds and pushes api + web)
   └────→ e2e (compose up → seed:demo → playwright)
```

The e2e job uploads the HTML report and traces on failure.

## Deployment

Compose on a cloud VM, Nginx terminating TLS with a Certbot certificate and
proxying `/` to web. Fastify stays on the internal Compose network, never
exposed publicly — a real security benefit of the BFF, not merely a side effect.
`COOKIE_SECURE=true` and a real `JWT_SECRET` come from the server's `.env`.

To be written up as `docs/deployment.md` with exact commands.

## Effort

Roughly 20 screens, ~40 components and three E2E journeys under a 100% gate.
This is several sessions of work. Build order should produce a working vertical
slice early — login through one role dashboard — rather than leaving everything
half-built until the end.

## Decisions not taken

- **Client-side fetching against the API directly.** Rejected: no data library
  in the locked dependencies, and it would put session handling in the browser.
- **Hybrid server reads with client writes.** Rejected: token rotation would
  need implementing twice.
- **Shared routes with role branching inside pages.** Rejected: scatters
  permission logic through components instead of stating it in the route tree.
- **A shared zod schema package.** Rejected as disproportionate; see Validation.
