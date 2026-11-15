// Server-only: Lovable AI Gateway calls (OpenAI Responses via the AI SDK), always streamed.
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";

const BASE_URL = "https://ai.gateway.lovable.dev/v1";
const MODEL = "openai/gpt-6-astra";

export class AiError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}

function provider() {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new AiError("AI is not configured for this app.");
  let runId: string | undefined;
  return createOpenAI({
    baseURL: BASE_URL,
    apiKey: key,
    headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      const res = await fetch(input, { ...init, headers });
      runId ??= res.headers.get("X-Lovable-AIG-Run-ID") ?? undefined;
      return res;
    },
  });
}

function friendly(e: unknown): AiError {
  const status = (e as { statusCode?: number })?.statusCode;
  if (status === 402) return new AiError("AI credits are used up for this workspace. Add credits to continue.", 402);
  if (status === 429) return new AiError("The AI service is busy right now. Please try again in a minute.", 429);
  if (status === 403) return new AiError("AI access is blocked for this workspace.", 403);
  console.error("AI call failed", e);
  return new AiError("The AI analysis couldn’t be completed. Please try again.", status);
}

/** Structured output with a strict schema; streamed and consumed server-side. */
export async function aiObject<T>(schema: z.ZodType<T>, instructions: string, prompt: string, background = false): Promise<T> {
  try {
    const result = streamText({
      model: provider().responses(MODEL),
      instructions,
      prompt,
      output: Output.object({ schema }),
      ...(background ? { maxRetries: 0 } : {}),
      providerOptions: {
        openai: {
          store: false,
          forceReasoning: true,
          reasoningEffort: "low",
          reasoningSummary: "auto",
          include: ["reasoning.encrypted_content"],
        },
      },
    });
    let err: unknown;
    // drain the stream so errors surface
    for await (const part of result.fullStream) if (part.type === "error") err = part.error;
    if (err) throw err;
    return (await result.output) as T;
  } catch (e) {
    if (NoObjectGeneratedError.isInstance(e)) {
      console.error("AI returned unparseable output", e.text?.slice(0, 500));
      throw new AiError("The AI response couldn’t be read. Please try again.");
    }
    if (e instanceof AiError) throw e;
    throw friendly(e);
  }
}
