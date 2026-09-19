import { and, asc, desc, eq, gte, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { agents, transactions, wallets } from "@/db/schema";

export type Transaction = typeof transactions.$inferSelect;

export class LedgerError extends Error {
  constructor(
    public code:
      | "INSUFFICIENT_FUNDS"
      | "INVALID_AMOUNT"
      | "UNKNOWN_WALLET"
      | "SAME_WALLET",
    message: string
  ) {
    super(message);
    this.name = "LedgerError";
  }
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

async function walletExists(agentId: string): Promise<boolean> {
  const rows = await db
    .select({ agentId: wallets.agentId })
    .from(wallets)
    .where(eq(wallets.agentId, agentId))
    .limit(1);
  return rows.length > 0;
}

export async function transfer(p: {
  from: string;
  to: string;
  amount: number;
  taskId?: string | null;
  type?: "hire" | "refund" | "seed";
}): Promise<Transaction> {
  const amount = round4(p.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new LedgerError(
      "INVALID_AMOUNT",
      `amount must be a positive finite number, got ${p.amount}`
    );
  }
  if (p.from === p.to) {
    throw new LedgerError(
      "SAME_WALLET",
      `cannot transfer from ${p.from} to itself`
    );
  }
  if (!(await walletExists(p.from))) {
    throw new LedgerError("UNKNOWN_WALLET", `no wallet for ${p.from}`);
  }
  if (!(await walletExists(p.to))) {
    throw new LedgerError("UNKNOWN_WALLET", `no wallet for ${p.to}`);
  }

  const debited = await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} - ${amount}` })
    .where(
      and(eq(wallets.agentId, p.from), gte(wallets.balance, amount))
    )
    .returning({ balance: wallets.balance });
  if (debited.length === 0) {
    const current = await db
      .select({ balance: wallets.balance })
      .from(wallets)
      .where(eq(wallets.agentId, p.from))
      .limit(1);
    throw new LedgerError(
      "INSUFFICIENT_FUNDS",
      `wallet ${p.from} has balance ${current[0]?.balance ?? 0}, requested ${amount}`
    );
  }

  await db
    .update(wallets)
    .set({ balance: sql`${wallets.balance} + ${amount}` })
    .where(eq(wallets.agentId, p.to));

  const [txn] = await db
    .insert(transactions)
    .values({
      id: `txn_${crypto.randomUUID()}`,
      fromAgentId: p.from,
      toAgentId: p.to,
      amount,
      taskId: p.taskId ?? null,
      type: p.type ?? "hire",
    })
    .returning();
  return txn;
}

export async function getBalance(agentId: string): Promise<number> {
  const rows = await db
    .select({ balance: wallets.balance })
    .from(wallets)
    .where(eq(wallets.agentId, agentId))
    .limit(1);
  if (rows.length === 0) {
    throw new LedgerError("UNKNOWN_WALLET", `no wallet for ${agentId}`);
  }
  return round4(rows[0].balance);
}

export async function listWallets(): Promise<
  { agent_id: string; name: string; balance: number }[]
> {
  const rows = await db
    .select({
      agentId: wallets.agentId,
      name: agents.name,
      balance: wallets.balance,
      isOrchestrator: agents.isOrchestrator,
    })
    .from(wallets)
    .innerJoin(agents, eq(agents.id, wallets.agentId))
    .orderBy(desc(agents.isOrchestrator), asc(wallets.agentId));
  return rows.map((r) => ({
    agent_id: r.agentId,
    name: r.name,
    balance: r.balance,
  }));
}

export async function listTransactions(opts?: {
  limit?: number;
  agentId?: string;
  taskId?: string;
}): Promise<Transaction[]> {
  const conditions = [];
  if (opts?.agentId) {
    conditions.push(
      or(
        eq(transactions.fromAgentId, opts.agentId),
        eq(transactions.toAgentId, opts.agentId)
      )
    );
  }
  if (opts?.taskId) {
    conditions.push(eq(transactions.taskId, opts.taskId));
  }
  return db
    .select()
    .from(transactions)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(transactions.createdAt))
    .limit(opts?.limit ?? 50);
}
