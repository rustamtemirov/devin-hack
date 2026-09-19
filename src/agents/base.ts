import type { Permission, TaskRequest } from "@/protocol";

export interface AgentContext {
  requestPermission(
    permission: Permission,
    justification: string
  ): Promise<"allowed" | "denied">;
  say(content: string): Promise<void>;
  sleep(ms: number): Promise<void>;
}

export interface AgentResult {
  result: unknown;
  confidence?: number;
}

export interface Agent {
  id: string;
  handle(req: TaskRequest, ctx: AgentContext): Promise<AgentResult>;
}

export class AgentError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AgentError";
  }
}
