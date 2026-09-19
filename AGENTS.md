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

## Notes
- `DATABASE_URL` unset → embedded PGlite (`.data/pglite`); set → Neon via `@neondatabase/serverless` HTTP driver.
- Protocol spec lives in `src/protocol/` (Zod schemas = types).
- Shared marketplace queries in `src/marketplace/registry.ts`.
