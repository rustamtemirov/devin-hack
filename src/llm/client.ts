import { anthropic } from "@ai-sdk/anthropic";

export const LLM_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";

export function llmEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export function getModel() {
  if (!llmEnabled()) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return anthropic(LLM_MODEL);
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
