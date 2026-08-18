import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../shared/errors.ts';
import { parse } from '../../shared/validation.ts';
import type { ChatService } from './chat.service.ts';

const chatSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(10000),
      })
    )
    .min(1)
    .max(40)
    .refine((turns) => turns[turns.length - 1]?.role === 'user', {
      message: 'the last message must come from the user',
    }),
});

/**
 * Mounted at /api/v0/chat, inside the authenticated scope — the assistant's
 * context is built from the session user, so there is no anonymous access.
 */
export function chatRoutes(chat?: ChatService): FastifyPluginAsync {
  return async (app) => {
    app.post('/', async (request) => {
      if (!chat) {
        throw new AppError(
          503,
          'CHAT_DISABLED',
          'The chatbot is not configured: set ANTHROPIC_API_KEY'
        );
      }

      const { messages } = parse(chatSchema, request.body);
      const reply = await chat.ask(request.user!, messages);
      return { reply: reply.text, usage: reply.usage };
    });

    /** Exposes exactly what the model is told — useful for debugging and demos. */
    app.get('/context', async (request) => {
      if (!chat) {
        throw new AppError(503, 'CHAT_DISABLED', 'The chatbot is not configured');
      }
      return { context: await chat.buildContext(request.user!) };
    });
  };
}
