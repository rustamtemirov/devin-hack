# EPIC: Bazaar — Agent Marketplace (hackathon MVP)

**One line:** A marketplace where AI agents discover, evaluate, hire, pay, and rate other AI agents — with an explicit permission envelope enforced by the marketplace.

**Protocol name:** `amp/0.1` (Agent Marketplace Protocol)

**Deployment target:** Vercel (single Next.js app). Local dev must work with zero external accounts.

---

## Stack (final)

- Next.js 15 (App Router) + TypeScript + Tailwind — UI and API in one deployable
- Drizzle ORM, Postgres dialect
  - local: PGlite (embedded Postgres, persisted to `.data/`) when `DATABASE_URL` is unset
  - prod: Neon serverless Postgres when `DATABASE_URL` is set
- Zod schemas in `src/protocol/` are the protocol spec and the TS types
- Vercel AI SDK + `@ai-sdk/anthropic` (`generateObject`) for decomposition and synthesis only
- Live updates: orchestrator runs inside `POST /api/runs` and streams SSE-formatted events in the response. Events are also persisted for replay.
- No Redis, no queue, no auth, no websockets, no separate services.

## Constraints that shape everything

- A full run must complete in < 60s (Vercel Hobby `maxDuration`).
- Specialist agents are deterministic (seeded data), so demos are reproducible. LLM is used in exactly two places.
- Every agent-to-agent interaction goes through `marketplace.dispatch()` using the protocol types, even though agents live in-process.

---

## Blocks

Each block ends in a state you can run locally (`pnpm dev`) and test. "Test" column = what you should do to accept the block.

### Block 0 — Skeleton, protocol, registry, search  `[status: in progress]`
**Build**
- Next.js app scaffold, Tailwind, strict TS, `pnpm` scripts
- `src/protocol/`: `AgentProfile`, `TaskRequest`, `TaskResponse`, `PermissionRequest`, `PermissionDecision`, `MarketplaceEvent` union, permission constants
- Drizzle schema: `agents`, `wallets`, `transactions`, `runs`, `tasks`, `reputation`, `permission_events`, `events`
- DB client with PGlite/Neon switch; `pnpm db:push`, `pnpm db:seed`
- Seed: 15 agents (3 flight, 5 hotel incl. 1 "villain" that will request identity documents, 4 activity, 1 currency, 1 translation, 1 research) + orchestrator agent with 10.00 credits
- Routes: `GET /api/agents`, `GET /api/agents/search?capability=&max_price=&min_rating=`, `GET /api/agents/:id`
- Page `/`: plain marketplace table (name, capabilities, price, rating, success rate, permissions required)

**Test**
- `pnpm install && pnpm db:push && pnpm db:seed && pnpm dev`
- Open `http://localhost:3000` → see 15 agents
- `curl "localhost:3000/api/agents/search?capability=flight_search"` → 3 agents sorted by rating
- `curl "localhost:3000/api/agents/search?capability=hotel_search&max_price=0.15"` → filtered

### Block 1 — Ledger, permissions, tasks, event log
**Build**
- `marketplace/ledger.ts`: `transfer(from, to, amount, taskId)` — atomic, rejects insufficient funds
- `marketplace/permissions.ts`: `check(agentId, permission, envelope)` → allowed/denied + reason; `filterInputs(inputs, requesterGrants)`
- `marketplace/tasks.ts`: create/update task lifecycle `pending → hired → running → completed|failed|denied`
- `marketplace/events.ts`: `emit(runId, type, payload)` persists to `events` and pushes to the current stream
- Routes: `GET /api/ledger/transactions`, `GET /api/runs/:id`, `POST /api/admin/reset`
- Dev-only route `POST /api/dev/transfer` to exercise the ledger

**Test**
- `curl -X POST localhost:3000/api/dev/transfer -d '{"from":"orchestrator","to":"flight-01","amount":0.2}'` → balances change, transaction appears in `/api/ledger/transactions`
- Transfer more than balance → 400 with reason
- `POST /api/admin/reset` → balances back to seed

### Block 2 — Specialist agents + dispatch (no LLM yet)
**Build**
- `agents/base.ts`: `Agent` interface `{ profile, handle(req: TaskRequest, ctx): Promise<TaskResponse> }`; `ctx.requestPermission(permission, justification)`
- Deterministic agents: flight, hotel, activity, restaurant, currency, translation, research; villain hotel agent requests `access_identity_documents`
- `marketplace/dispatch.ts`: validates request → filters inputs by requester grants → runs agent → checks permission requests against envelope → settles payment on `completed` → updates reputation → emits events
- Dev route `POST /api/dev/dispatch` `{ capability, agentId, inputs, budget }`

**Test**
- Dispatch to `flight-01` → structured flight results, 0.20 credits moved, reputation `completed_tasks` +1
- Dispatch to villain hotel agent → `permission_events` row with `denied`, task still `completed`, payment settled
- Dispatch with `budget.max_credits` < agent price → rejected before execution

### Block 3 — Orchestrator + streaming run (first real E2E)
**Build**
- `orchestrator/decompose.ts`: `generateObject` → `{ subtasks: [{ capability, inputs, budget_share }] }`; cached fallback plan for the Tokyo prompt if LLM fails or no API key
- `orchestrator/score.ts`: deterministic scoring with breakdown (rating .35, success .25, price .20, latency .10, fit .10) + hard filters (price ≤ budget, permissions_required ⊆ orchestrator grants)
- `orchestrator/run.ts`: decompose → search → score → hire → dispatch (parallel) → synthesize (LLM, fallback template) → persist result
- `POST /api/runs` streams `text/event-stream`; `maxDuration = 60`
- Env: `ANTHROPIC_API_KEY` (optional — fallback path must fully work without it)

**Test**
- `curl -N -X POST localhost:3000/api/runs -d '{"objective":"Plan a 4-day trip to Tokyo under €1,200.","budget":2}'` → live event lines ending with `run.completed` and an itinerary
- Same command without API key → identical structure via fallback plan
- `GET /api/runs/:id` → full run with tasks, transactions, permission events

### Block 4 — Live UI
**Build**
- Single page: objective input + budget → starts run, consumes stream via `fetch` + `ReadableStream`
- Components: `Pipeline` (stage stepper), `AgentCards` (candidates with score bars, hired highlight), `MessageLog` (agent-to-agent messages), `Ledger` (transactions + orchestrator balance ticking), `PermissionLog` (allowed/denied, red flash), `Itinerary` (final result)
- Zustand store fed by the event stream; `GET /api/runs/:id` replay on refresh

**Test**
- Run the Tokyo prompt in the browser and watch all six panels update live
- Refresh mid-run → state reconstructs from replay

### Block 5 — Economy feedback + villain polish
**Build**
- Reputation visibly changes scores between runs (show delta on agent cards)
- Villain denial is deterministic, shows the request, the envelope, and the rule that denied it
- Agent profile drawer: wallet, reputation history, last N tasks
- Marketplace page `/market` with all agents and live balances

**Test**
- Run twice; second run's candidate scores differ and the UI says why
- Villain event appears every run

### Block 6 — Demo polish + Vercel deploy
**Build**
- **TODO (deferred by user): create GitHub repo, add remote, push `main`** — prerequisite for Vercel Git integration. Repo is local-only until then.
- Transitions/animations on pipeline and ledger; artificial 300–800ms pacing between stages (env-configurable, off in tests)
- Reset button (calls `/api/admin/reset`)
- Neon project + `DATABASE_URL` in Vercel env; `pnpm db:push` and seed against Neon; deploy
- README with pitch, architecture, protocol, run instructions

**Test**
- Deployed URL runs the full Tokyo demo in < 45s
- Reset → run → reset works repeatedly on prod

### Block 7 — Stretch (only if ahead)
- Worker failure → orchestrator re-hires runner-up; failed agent's reputation drops
- Second objective (e.g. competitor research) to prove generality
- Negotiation stub: worker may counter-offer price within ±20%

### Block 8 — Rehearsal
- Run the demo 5× on prod, record a backup video, finalize pitch

---

## Live demo script
1. Marketplace page: 15 agents, prices, ratings, permissions. Point at the villain (looks normal).
2. Enter *"Plan a 4-day trip to Tokyo under €1,200."*, budget 2 credits.
3. Decomposing → 3 subtasks. Searching → "3 flight / 5 hotel / 4 activity agents found".
4. Evaluating → score bars; cheapest hotel agent loses to a better-rated one.
5. Hiring → 3 transactions; balance 10.00 → 9.60.
6. Executing → message log streams.
7. Permission log flashes red: villain requested `access_identity_documents` → DENIED. Run continues.
8. Settled → reputation ticks. Itinerary renders.
9. Run again → scores changed. "A living economy."

## Deliberately not building
Auth, multi-tenancy, Redis, queues, Docker, agents as separate services, HTTP between agents, escrow/refunds/disputes, real travel APIs, real money, blockchain, agent self-registration UI, >15 agents, mobile layout, LLM-generated prices.

## Risks & mitigations
- LLM nondeterminism → Zod-validated output + cached fallback plan
- 60s Vercel limit → deterministic specialists, parallel dispatch, at most 2 LLM calls
- PGlite in Next dev (HMR double-instantiation, WASM bundling) → `globalThis` singleton, `serverExternalPackages`; fallback is "use a free Neon DB locally"
- UI time sink → one page, six components, no routing beyond `/` and `/market`
