import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";

export type LlmProvider = "anthropic" | "google";

export function llmProvider(): LlmProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GOOGLE_GENERATIVE_AI_API_KEY) return "google";
  return null;
}

export function llmEnabled(): boolean {
  return llmProvider() !== null;
}

export function llmLabel(): string {
  const p = llmProvider();
  if (p === "anthropic")
    return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  if (p === "google") return process.env.GOOGLE_MODEL ?? "gemini-3.5-flash";
  return "fallback";
}

export function getModel() {
  const p = llmProvider();
  if (p === "anthropic") return anthropic(llmLabel());
  if (p === "google") return google(llmLabel());
  throw new Error("no LLM API key is set");
}

export async function withTimeout<T>(
  p: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
