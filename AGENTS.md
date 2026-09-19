# Bazaar — dev commands

## Setup
```sh
pnpm install
```

## Database (PGlite local, no accounts needed)
```sh
pnpm db:push    # drizzle-kit push — PGlite at .data/pglite when DATABASE_URL unset, Neon when set
pnpm db:seed    # truncate + insert 16 agents (15 specialists + orchestrator)
pnpm db:reset   # same as db:seed
pnpm db:generate # generate SQL migrations into ./drizzle (optional)
```

## Dev
```sh
pnpm dev        # http://localhost:3000
```

## Checks
```sh
pnpm typecheck  # tsc --noEmit
pnpm lint
pnpm build
```

## Verify Block 0
```sh
curl -s localhost:3000/api/agents | jq '.agents | length'          # 15
curl -s "localhost:3000/api/agents/search?capability=flight_search" | jq '.agents[].id'
curl -s "localhost:3000/api/agents/search?capability=hotel_search&max_price=0.15" | jq '.agents | length'  # 3
curl -s localhost:3000/api/agents/hotel-04 | jq .wallet
```

## Verify Block 1
```sh
pnpm test   # vitest, pure unit tests in src/marketplace/permissions.test.ts

curl -s -X POST localhost:3000/api/admin/reset                  # {"ok":true,"agents":16}
curl -s -X POST localhost:3000/api/dev/transfer -H 'content-type: application/json' \
  -d '{"from":"orchestrator","to":"flight-01","amount":0.2}'    # balances 9.8 / 1.2
curl -s -X POST localhost:3000/api/dev/transfer -H 'content-type: application/json' \
  -d '{"from":"orchestrator","to":"flight-01","amount":100}'    # 400 INSUFFICIENT_FUNDS
curl -s -X POST localhost:3000/api/dev/transfer -H 'content-type: application/json' \
  -d '{"from":"orchestrator","to":"nope","amount":0.1}'         # 400 UNKNOWN_WALLET
curl -s "localhost:3000/api/ledger/transactions?limit=3"        # newest first
curl -s localhost:3000/api/ledger/wallets | jq '.wallets | length'  # 16
open http://localhost:3000/dev                                   # Dev Console UI
curl -s -X POST localhost:3000/api/dev/permission-check -H 'content-type: application/json' \
  -d '{"permission":"access_identity_documents","envelope":["share_destination"],"inputs":{"destination":"Tokyo","passport_number":"X"}}'
curl -s -X POST localhost:3000/api/dev/simulate-task -H 'content-type: application/json' \
  -d '{"capability":"flight_search","worker_id":"flight-01","cost":0.2}'
curl -s localhost:3000/api/runs/<run_id>                        # run detail; 404 for unknown id
```

## Verify Block 2
```sh
pnpm test   # 11 tests (permissions + reputation)

curl -s -X POST localhost:3000/api/admin/reset
# dispatch (dev route): { worker_id, capability, inputs, budget, run_id?, requester_id? }
curl -s -X POST localhost:3000/api/dev/dispatch -H 'content-type: application/json' \
  -d '{"worker_id":"flight-01","capability":"flight_search","inputs":{"origin":"Berlin","destination":"Tokyo","travel_dates":"2026-10-01..2026-10-05","budget":1200,"passport_number":"X123"},"budget":0.5}'
# → completed, pays agent price, reputation bumps, emits task.status/agent.message/agent.hired/ledger.transfer/reputation.updated
# villain: worker_id hotel-04 → completed + permission_events denied for access_identity_documents
# flight-02 budget 0.3 → failed BUDGET_EXCEEDED, no txn
# currency-01 inputs {"amount":1200,"from_currency":"EUR","to_currency":"JPY"} → converted 194880
# flight-01 without travel_dates → failed MISSING_REQUIREMENTS
```

### Schema changed in Block 2
All money/ratio columns went `real` → `doublePrecision`. `pnpm db:push` now uses `drizzle-kit push --force` (non-interactive, auto-approves type changes). If push fails or data is corrupted, wipe and reseed:
```sh
rm -rf .data && pnpm db:push && pnpm db:seed
```
PGlite allows only ONE process per data dir. `pnpm dev` holds `.data/pglite` open — while a dev server runs, `pnpm db:push`/`db:seed` will abort. Either stop the dev server first, or use a scratch dir via `PGLITE_DATA_DIR`:
```sh
PGLITE_DATA_DIR=/tmp/bazaar-test pnpm db:push
PGLITE_DATA_DIR=/tmp/bazaar-test pnpm dev -p 3100   # run dev against scratch DB
```
`AGENT_LATENCY_SCALE` (default 0.3) scales agent sleeps; `0` disables.

### Concurrency warning (verified)
PGlite has **no file lock**. Running `pnpm db:seed` (or `db:push`) against a data dir while `pnpm dev` is using it does NOT fail or hang — the second process reports success, but the two instances diverge (the dev server keeps serving its own view) and the on-disk dir is corrupted: the next process to open it crashes with `RuntimeError: Aborted()`. Recovery: `rm -rf <dir> && pnpm db:push && pnpm db:seed`. Always stop the dev server before db scripts on `.data`, or use separate `PGLITE_DATA_DIR`s.
The dev server now closes PGlite cleanly on SIGINT/SIGTERM (see `src/db/client.ts`), and DB instantiation is lazy so Next worker processes never open the data dir.

## Verify Block 3
```sh
# streaming orchestrated run (SSE); needs a dev server, e.g.:
STAGE_DELAY_MS=200 pnpm dev
curl -sN -X POST localhost:3000/api/runs -H 'content-type: application/json' \
  -d '{"objective":"Plan a 4-day trip to Tokyo under €1,200.","budget":2}'
# → SSE frames: run.created → run.started → run.decomposed → market.searched/evaluated ×4
#   → task.status/agent.message/agent.hired/permission.checked/ledger.transfer/reputation.updated
#   → run.completed with itinerary_markdown. Persists everything.
curl -s localhost:3000/api/runs | jq '.runs[0]'      # newest first
curl -s localhost:3000/api/runs/<run_id>             # full detail (tasks, txns, permission_events, events)
curl -s -X POST localhost:3000/api/runs -d '{"objective":"hi"}'   # 400
# /dev "Run" panel streams the same events live.
```

### Env vars
- `ANTHROPIC_API_KEY` — unset → deterministic fallback plan + template itinerary (fully works)
- `ANTHROPIC_MODEL` — default `claude-sonnet-4-5`
- `STAGE_DELAY_MS` — pacing between orchestration stages, default 600, `0` disables
- `AGENT_LATENCY_SCALE` — scales agent sleeps, default 0.3, `0` disables
- `PGLITE_DATA_DIR` — override PGlite data dir (see concurrency warning above)
- `ENABLE_DEV_ROUTES=1` — expose /api/dev/* in production builds

## Notes
- `DATABASE_URL` unset → embedded PGlite (`.data/pglite`); set → Neon via `@neondatabase/serverless` HTTP driver.
- Protocol spec lives in `src/protocol/` (Zod schemas = types).
- Shared marketplace queries in `src/marketplace/registry.ts`.
