/**
 * Provider-agnostic wrapper over Vercel AI Gateway + AI SDK v6.
 *
 * The rest of the app uses these two functions instead of touching `ai`
 * or `@ai-sdk/anthropic` directly. That keeps provider swaps (or even
 * pulling the gateway out) a single-file diff.
 */
import {
  generateText as aiGenerateText,
  generateObject as aiGenerateObject,
  type LanguageModelUsage,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import type { ZodSchema } from 'zod';

export interface GenerateTextArgs {
  /** Gateway-format model string, e.g. `anthropic/claude-haiku-4-5`. */
  model: string;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface GenerateTextResult {
  text: string;
  usage: LanguageModelUsage;
}

export async function generateText(args: GenerateTextArgs): Promise<GenerateTextResult> {
  const result = await aiGenerateText({
    model: gateway(args.model),
    prompt: args.prompt,
    ...(args.system !== undefined && { system: args.system }),
    ...(args.maxOutputTokens !== undefined && { maxOutputTokens: args.maxOutputTokens }),
    ...(args.temperature !== undefined && { temperature: args.temperature }),
  });
  return { text: result.text, usage: result.usage };
}

export interface GenerateObjectArgs<T> {
  model: string;
  schema: ZodSchema<T>;
  prompt: string;
  system?: string;
  maxOutputTokens?: number;
  /** Name used by some providers for tool-use-style structured output. */
  schemaName?: string;
  schemaDescription?: string;
}

export interface GenerateObjectResult<T> {
  object: T;
  usage: LanguageModelUsage;
}

export async function generateObject<T>(
  args: GenerateObjectArgs<T>,
): Promise<GenerateObjectResult<T>> {
  const result = await aiGenerateObject({
    model: gateway(args.model),
    schema: args.schema,
    prompt: args.prompt,
    ...(args.system !== undefined && { system: args.system }),
    ...(args.maxOutputTokens !== undefined && { maxOutputTokens: args.maxOutputTokens }),
    ...(args.schemaName !== undefined && { schemaName: args.schemaName }),
    ...(args.schemaDescription !== undefined && { schemaDescription: args.schemaDescription }),
  });
  return { object: result.object as T, usage: result.usage };
}
