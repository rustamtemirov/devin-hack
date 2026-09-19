import { db, dbKind } from "./client";
import {
  agents,
  wallets,
  transactions,
  runs,
  tasks,
  reputation,
  permissionEvents,
  events,
} from "./schema";
import { SEED_AGENTS } from "./seed-data";

export async function seed() {
  // truncate in dependency-safe order
  await db.delete(events);
  await db.delete(permissionEvents);
  await db.delete(tasks);
  await db.delete(runs);
  await db.delete(transactions);
  await db.delete(wallets);
  await db.delete(reputation);
  await db.delete(agents);

  for (const a of SEED_AGENTS) {
    await db.insert(agents).values({
      id: a.id,
      name: a.name,
      description: a.description,
      capabilities: a.capabilities,
      pricingModel: "per_task",
      price: a.price,
      currency: "CREDIT",
      latencyMsP50: a.latencyMsP50,
      requiredPermissions: a.permissionsRequired,
      grantedPermissions: a.permissionsRequired,
      requirements: a.requirements,
      isOrchestrator: a.isOrchestrator ?? false,
    });
    await db.insert(wallets).values({ agentId: a.id, balance: a.balance });
    await db.insert(reputation).values({
      agentId: a.id,
      rating: a.rating,
      successRate: a.successRate,
      completedTasks: a.completedTasks,
      failedTasks: a.failedTasks,
      avgLatencyMs: a.latencyMsP50,
    });
    await db.insert(transactions).values({
      id: `seed-${a.id}`,
      fromAgentId: "system",
      toAgentId: a.id,
      amount: a.balance,
      taskId: null,
      type: "seed",
    });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seed()
    .then(() => {
      console.log(`Seeded ${SEED_AGENTS.length} agents (db: ${dbKind})`);
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
