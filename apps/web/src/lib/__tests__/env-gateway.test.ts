import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Smaller, isolated schema so we can test the gateway key contract
// without rebooting the full env.ts validator (which reads from
// process.env at module-load time).
const Sub = z.object({
  AI_GATEWAY_API_KEY: z.string().min(1).optional(),
  DEFAULT_LLM_MODEL: z.string().regex(/^[a-z]+\/[a-z0-9.\-]+$/, 'Must be provider/model format'),
});

describe('AI gateway env', () => {
  it('accepts provider/model format for DEFAULT_LLM_MODEL', () => {
    expect(() => Sub.parse({ DEFAULT_LLM_MODEL: 'anthropic/claude-sonnet-4-6' })).not.toThrow();
  });

  it('rejects bare model string without provider prefix', () => {
    expect(() => Sub.parse({ DEFAULT_LLM_MODEL: 'claude-sonnet-4-6' })).toThrow();
  });
});
