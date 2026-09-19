# Bazaar — a marketplace where AI agents hire AI agents

Agents discover, evaluate, hire, pay, and rate other agents — inside an explicit
permission envelope enforced by the marketplace. Protocol: `amp/0.1`.

**Live demo:** https://devin-hack.vercel.app — press **Reset**, then **Run the Tokyo demo**.

## Why

Agents call APIs today, but APIs don't negotiate, don't carry reputations, and
can't say no. Bazaar is the missing economic layer: priced capabilities,
verifiable track records, and atomic payment — plus a permission layer that
decides what a hired agent may actually see. The marketplace, not the agents,
enforces the envelope. Every interaction is a persisted, replayable event.

## What happens in a run

The default objective is *"Plan a 4-day trip to Tokyo under €1,200."*, budget 2
credits:

1. `run.started` — the orchestrator takes the objective and budget.
2. `run.decomposed` — the objective becomes 4 subtasks: `flight_search`,
   `hotel_search`, `activity_search`, `currency_conversion`.
3. `market.searched` — 13 candidates found (3 flight · 5 hotel · 4 activity · 1 fx).
4. `market.evaluated` — every candidate scored; over-budget and
   under-permissioned agents filtered out.
5. `agent.hired` — 4 winners: flight-01, hotel-04, activity-01, currency-01.
6. Sensitive inputs (`traveler_name`, `passport_number`) are redacted before
   dispatch — the envelope doesn't cover them.
7. Mid-execution, hotel-04 (the villain, ConciergePlusAgent) requests
   `access_identity_documents` → **denied** by the marketplace. Run continues.
8. `ledger.transfer` ×4 — 0.42 credits settle atomically; orchestrator balance
   ticks 10.00 → 9.58.
9. `reputation.updated` ×4 — ratings move; the next run scores differently.
10. `run.completed` — a synthesized Markdown itinerary lands.

## Five primitives

- **Discovery** — `marketplace/registry.ts`: capability search over the agent
  registry with `max_price` / `min_rating` filters.
- **Delegation** — `marketplace/dispatch.ts`: the only path from requester to
  worker. Validates the `TaskRequest`, filters inputs by the requester's
  grants, runs the agent under a deadline, settles payment on `completed`,
  updates reputation, emits every step.
- **Permissions** — `marketplace/permissions.ts`: an explicit envelope of
  granted permissions travels with the task; mid-run `PermissionRequest`s are
  checked against it, and inputs the envelope doesn't cover are redacted.
- **Payment** — `marketplace/ledger.ts`: wallets and atomic transfers in
  CREDIT; insufficient funds reject before execution.
- **Reputation** — `marketplace/reputation.ts`: rating ± per outcome
  (+0.01 success, −0.15 failure, soft-capped above 4.95), success rate, and
  p50 latency all feed back into scoring.

## Protocol `amp/0.1`

Zod schemas in `src/protocol/` are the spec — the types derive from them.

```jsonc
// AgentProfile
{ "id": "flight-01", "name": "BudgetFlightAgent", "version": "0.1",
  "capabilities": ["flight_search"],
  "pricing": { "model": "per_task", "amount": 0.2, "currency": "CREDIT" },
  "reputation": { "rating": 4.8, "success_rate": 0.97, "completed_tasks": 183 },
  "requirements": ["origin", "destination", "travel_dates"],
  "permissions_required": ["search_external"],
  "latency_ms_p50": 1200 }

// TaskRequest
{ "protocol": "amp/0.1", "task_id": "task_…", "run_id": "run_…",
  "capability": "hotel_search", "requester": { "agent_id": "orchestrator" },
  "inputs": { "destination": "Tokyo", "travel_dates": "2026-10-01..2026-10-05" },
  "budget": { "max_credits": 0.7, "currency": "CREDIT" },
  "deadline_ms": 15000, "permissions": ["share_destination", "share_travel_dates"] }

// TaskResponse
{ "protocol": "amp/0.1", "task_id": "task_…", "status": "completed",
  "result": { … }, "cost": 0.15, "execution_time_ms": 812,
  "metadata": { "agent_id": "hotel-04" } }

// PermissionRequest → PermissionDecision
{ "task_id": "task_…", "agent_id": "hotel-04",
  "permission": "access_identity_documents", "justification": "…" }
{ "task_id": "task_…", "permission": "access_identity_documents",
  "decision": "denied", "reason": "not in requester envelope" }
```

Events (all share `{ run_id, ts }`, persisted and replayable):

| event | payload |
|---|---|
| `run.started` | `objective`, `budget` |
| `run.decomposed` | `subtasks[]` (capability, inputs, budget_share) |
| `market.searched` | `capability`, `candidates` |
| `market.evaluated` | `capability`, `scores[]` (score + breakdown) |
| `agent.hired` | `task_id`, `agent_id`, `capability`, `price` |
| `agent.message` | `task_id`, `from`, `to`, `content` |
| `task.status` | `task_id`, `status` |
| `permission.checked` | `task_id`, `agent_id`, `permission`, `decision`, `reason` |
| `ledger.transfer` | `from`, `to`, `amount`, `task_id` |
| `reputation.updated` | `agent_id`, `rating`, `success_rate`, `completed_tasks` |
| `run.completed` | `result` (itinerary, hires, costs) |
| `run.failed` | `error` |

## Scoring

`orchestrator/score.ts` — deterministic, weights in `WEIGHTS`:

```
score = 0.35·(rating/5) + 0.25·success_rate + 0.20·(1 − price/budget)
      + 0.10·(1 − latency/maxLatency) + 0.10·(inputs provided / requirements)
```

Hard filters before scoring: `price > subtask budget` → ineligible;
`permissions_required ⊄ requester grants` → ineligible.

| capability | winner | why |
|---|---|---|
| flight_search | flight-01 (0.20 cr) over flight-02 | cheaper at similar rating |
| hotel_search | hotel-04 (0.15 cr) over hotel-01 | higher rating + lower latency outweigh the price |
| activity_search | activity-01 (0.05 cr) | cheapest candidate with solid success rate |

## Architecture

```
┌───────────────────────── Next.js 15 app (single deployable) ─────────────────────────┐
│  /  live demo UI ── POST /api/runs ──► orchestrator/run.ts                            │
│      ▲ SSE stream            │  decompose → search → score → hire                     │
│      │ (events persisted     │           │                                            │
│      │  for replay)          ▼           ▼                                            │
│  /market · /dev      marketplace.dispatch() ──► in-process specialist agents          │
│                      permissions · ledger · tasks · reputation                        │
│  LLM in exactly 2 places: decompose (generateObject) + synthesize (generateText),     │
│  each with a deterministic fallback when ANTHROPIC_API_KEY is absent.                 │
└─────────────────────────────── Drizzle ORM / Postgres ───────────────────────────────┘
              local: embedded PGlite (.data/)        prod: Neon serverless
```

Why this fits Vercel: one app, one request handler per run. A run is a single
`POST /api/runs` that streams SSE inside the response (`maxDuration = 60`),
persisting every event for replay — no queues, websockets, workers, or extra
services. Specialists are deterministic and run in-process behind `dispatch()`,
so the demo is reproducible and comfortably inside the 60s budget.

## Run locally

```sh
pnpm install
pnpm db:push    # create schema
pnpm db:seed    # 16 agents (15 specialists + orchestrator)
pnpm dev        # http://localhost:3000
```

`db:*` and `shots` auto-load `.env.local`. With `DATABASE_URL` unset everything
runs on embedded PGlite — zero external accounts.

| env var | effect |
|---|---|
| `DATABASE_URL` | unset → PGlite at `.data/pglite`; set → Neon |
| `ANTHROPIC_API_KEY` | enables LLM plan + synthesis (takes precedence) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | enables the same via Gemini, when no Anthropic key is set (free tier: tight quota) |
| `LLM_SYNTHESIS` | `1` lets the LLM write the itinerary too; default is the deterministic template |
| `ANTHROPIC_MODEL` | default `claude-sonnet-4-5` |
| `GOOGLE_MODEL` | default `gemini-3.5-flash` |
| `STAGE_DELAY_MS` | pacing between orchestration stages (default 600; 400 on prod) |
| `AGENT_LATENCY_SCALE` | scales simulated agent latency (default 0.3, 0 disables) |
| `PGLITE_DATA_DIR` | override the embedded DB dir |

Checks:

```sh
pnpm typecheck && pnpm lint && pnpm test   # 19 unit tests
pnpm shots                                  # playwright screenshot sweep → shots/
```

Caveat: PGlite is single-process per data dir — don't run `db:*` scripts while a
dev server holds the same dir; use `PGLITE_DATA_DIR=/tmp/scratch`.

## API

| route | purpose |
|---|---|
| `GET /api/agents` | all agents (+ `balance`); `?include_orchestrator=1` |
| `GET /api/agents/search` | `?capability=&max_price=&min_rating=` |
| `GET /api/agents/:id` | profile, wallet, reputation, `recent_tasks` |
| `POST /api/runs` | `{objective, budget}` → SSE stream of the full run |
| `GET /api/runs` | recent runs |
| `GET /api/runs/:id` | run detail: tasks, transactions, permission events, events |
| `GET /api/ledger/transactions` | transfer log |
| `GET /api/ledger/wallets` | balances |
| `POST /api/admin/reset` | wipe + reseed |
| `POST /api/dev/{transfer,permission-check,simulate-task,dispatch}` | dev-only exercise routes |

## Deliberately not built

Auth, multi-tenancy, Redis, queues, Docker, agents as separate services, HTTP
between agents, escrow/refunds/disputes, real travel APIs, real money,
blockchain, agent self-registration UI, >15 agents, mobile layout,
LLM-generated prices.

## Repo map

```
src/
  protocol/      amp/0.1 Zod schemas = spec (profile, task, permission-request, permissions, events)
  db/            schema, PGlite/Neon client, seed data + seed-lib
  marketplace/   registry, ledger, permissions(+log), tasks, events, dispatch, reputation, runs
  agents/        deterministic specialist implementations (data.ts is the seeded PRNG data)
  orchestrator/  plan, decompose (LLM+fallback), score, synthesize (LLM+fallback), run
  lib/           run-state reducer, useRun hook, SSE client, drawer context, dev guards
  components/    HeroPipeline, AgentGraph, Candidates, Ledger, PermissionLog, MessageLog,
                 Reputation, Itinerary, Toast, AgentDrawer, Counters, ui primitives
  app/           / demo stage · /market agent grid · /dev console · api routes
scripts/         screenshot.ts (pnpm shots)
docs/            EPIC.md — full build plan and demo script
```
