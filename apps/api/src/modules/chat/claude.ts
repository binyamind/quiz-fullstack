import { AppError } from '../../shared/errors.ts';

/**
 * A very small Anthropic Messages API client built on `fetch`.
 *
 * `@anthropic-ai/sdk` is not in the locked dependency list, so the two calls the
 * chatbot needs are issued directly against the REST API.
 */

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeConfig {
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** `low` keeps a chat reply fast; thinking stays on (adaptive by default). */
  effort?: 'low' | 'medium' | 'high';
  fetchImpl?: typeof fetch;
}

export interface ClaudeReply {
  text: string;
  stopReason: string | null;
  usage: { inputTokens: number; outputTokens: number };
}

interface AnthropicResponse {
  content: { type: string; text?: string }[];
  stop_reason: string | null;
  stop_details?: { category?: string | null } | null;
  usage?: { input_tokens?: number; output_tokens?: number };
}

const API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';

export interface ClaudeClient {
  complete(system: string, messages: ChatTurn[]): Promise<ClaudeReply>;
}

export function createClaudeClient(config: ClaudeConfig): ClaudeClient {
  const doFetch = config.fetchImpl ?? fetch;

  return {
    async complete(system, messages) {
      const response = await doFetch(API_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': API_VERSION,
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: config.maxTokens ?? 1024,
          system,
          // Thinking is on by default on Claude Opus 5; `low` effort keeps a
          // chat turn responsive without disabling it.
          output_config: { effort: config.effort ?? 'low' },
          messages,
        }),
      });

      if (!response.ok) {
        const detail = await response.text();
        // 429 and 5xx are the caller's problem to retry; surface them as 502.
        throw new AppError(
          502,
          'CHAT_UPSTREAM_ERROR',
          `Claude API returned ${response.status}`,
          detail.slice(0, 500)
        );
      }

      const body = (await response.json()) as AnthropicResponse;

      // Safety classifiers can decline a request: HTTP 200 with an empty or
      // partial `content`, so `stop_reason` must be checked before reading it.
      if (body.stop_reason === 'refusal') {
        throw new AppError(
          422,
          'CHAT_REFUSED',
          'The assistant declined to answer that request',
          body.stop_details?.category ?? null
        );
      }

      const text = body.content
        .filter((block) => block.type === 'text' && block.text)
        .map((block) => block.text)
        .join('')
        .trim();

      return {
        text,
        stopReason: body.stop_reason,
        usage: {
          inputTokens: body.usage?.input_tokens ?? 0,
          outputTokens: body.usage?.output_tokens ?? 0,
        },
      };
    },
  };
}
