import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../../shared/errors.ts';
import { createClaudeClient } from './claude.ts';

const CONFIG = { apiKey: 'sk-test', model: 'claude-opus-5' };

function reply(body: unknown, ok = true): Response {
  return {
    ok,
    async json() {
      return body;
    },
    async text() {
      return JSON.stringify(body);
    },
  } as Response;
}

const MESSAGES = [{ role: 'user' as const, content: 'hi' }];

describe('claude client', () => {
  it('returns the concatenated text, stop reason and usage', async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        content: [
          { type: 'text', text: 'Hello' },
          { type: 'thinking', text: 'ignored' },
          { type: 'text', text: 'there' },
        ],
        stop_reason: 'end_turn',
        usage: { input_tokens: 12, output_tokens: 5 },
      })
    );

    const result = await createClaudeClient({ ...CONFIG, fetchImpl }).complete(
      'system',
      MESSAGES
    );

    expect(result.text).toContain('Hello');
    expect(result.text).toContain('there');
    expect(result.text).not.toContain('ignored');
    expect(result.stopReason).toBe('end_turn');
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 5 });
  });

  it('defaults the usage counters when the response omits them', async () => {
    const fetchImpl = vi.fn(async () =>
      reply({ content: [{ type: 'text', text: 'hi' }], stop_reason: null })
    );

    const result = await createClaudeClient({ ...CONFIG, fetchImpl }).complete(
      'system',
      MESSAGES
    );

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(result.stopReason).toBeNull();
  });

  it('turns a refusal into a 422 carrying the category', async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        content: [],
        stop_reason: 'refusal',
        stop_details: { category: 'harmful_content' },
      })
    );

    const error = await createClaudeClient({ ...CONFIG, fetchImpl })
      .complete('system', MESSAGES)
      .catch((e: AppError) => e);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).statusCode).toBe(422);
    expect((error as AppError).code).toBe('CHAT_REFUSED');
    expect((error as AppError).details).toBe('harmful_content');
  });

  it('handles a refusal that carries no stop details', async () => {
    const fetchImpl = vi.fn(async () =>
      reply({ content: [], stop_reason: 'refusal' })
    );

    const error = await createClaudeClient({ ...CONFIG, fetchImpl })
      .complete('system', MESSAGES)
      .catch((e: AppError) => e);

    expect((error as AppError).statusCode).toBe(422);
    expect((error as AppError).details).toBeNull();
  });

  it('handles a refusal whose stop details name no category', async () => {
    const fetchImpl = vi.fn(async () =>
      reply({ content: [], stop_reason: 'refusal', stop_details: {} })
    );

    const error = await createClaudeClient({ ...CONFIG, fetchImpl })
      .complete('system', MESSAGES)
      .catch((e: AppError) => e);

    expect((error as AppError).details).toBeNull();
  });

  it('falls back to the global fetch when none is injected', async () => {
    const globalFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      reply({
        content: [{ type: 'text', text: 'from global fetch' }],
        stop_reason: 'end_turn',
      })
    );

    const result = await createClaudeClient(CONFIG).complete(
      'system',
      MESSAGES
    );

    expect(result.text).toBe('from global fetch');
    expect(globalFetch).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ method: 'POST' })
    );

    globalFetch.mockRestore();
  });
});
