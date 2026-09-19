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
curl -s -X POST localhost:3000/api/dev/permission-check -H 'content-type: application/json' \
  -d '{"permission":"access_identity_documents","envelope":["share_destination"],"inputs":{"destination":"Tokyo","passport_number":"X"}}'
curl -s -X POST localhost:3000/api/dev/simulate-task -H 'content-type: application/json' \
  -d '{"capability":"flight_search","worker_id":"flight-01","cost":0.2}'
curl -s localhost:3000/api/runs/<run_id>                        # run detail; 404 for unknown id
```

## Notes
- `DATABASE_URL` unset → embedded PGlite (`.data/pglite`); set → Neon via `@neondatabase/serverless` HTTP driver.
- Protocol spec lives in `src/protocol/` (Zod schemas = types).
- Shared marketplace queries in `src/marketplace/registry.ts`.
