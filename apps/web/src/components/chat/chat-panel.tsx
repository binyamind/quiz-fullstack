'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState, useTransition } from 'react';
import { sendChatAction } from '@/actions/auth.ts';
import { Button } from '@/components/ui/button.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import type { ChatTurn } from '@/lib/types.ts';

export function ChatPanel() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function send() {
    const content = draft.trim();
    if (!content) return;
    const nextTurns: ChatTurn[] = [...turns, { role: 'user', content }];
    setTurns(nextTurns);
    setDraft('');
    setError(null);
    startTransition(async () => {
      const result = await sendChatAction(nextTurns);
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setTurns((current) => [
        ...current,
        { role: 'assistant', content: result.reply },
      ]);
    });
  }

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="rounded-md border border-line bg-white px-3 py-1.5 text-sm text-ink hover:border-binding focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-binding"
        >
          Ask the hall
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30" />
        <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-line bg-paper shadow-card">
          <div className="border-b border-line px-5 py-4">
            <Dialog.Title className="font-display text-xl">
              Hall assistant
            </Dialog.Title>
            <Dialog.Description className="text-sm text-muted">
              Grounded in your classes, people, and marks.
            </Dialog.Description>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {turns.length === 0 ? (
              <p className="text-sm text-muted">
                Ask who teaches a class, what is due, or how the school is
                averaging.
              </p>
            ) : null}
            {turns.map((turn, index) => (
              <div
                key={`${turn.role}-${index}`}
                className={
                  turn.role === 'user'
                    ? 'ml-8 rounded-md bg-white px-3 py-2 text-sm'
                    : 'mr-8 rounded-md bg-binding-soft px-3 py-2 text-sm'
                }
              >
                {turn.content}
              </div>
            ))}
            {error ? <p className="text-sm text-danger">{error}</p> : null}
          </div>
          <form
            className="border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask a question"
              rows={3}
            />
            <Button type="submit" className="mt-3" disabled={pending}>
              {pending ? 'Thinking…' : 'Send'}
            </Button>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
