import { useRef, useState, type FormEvent } from 'react';
import { api } from '../../api/client';
import type { AgentReply } from '../../api/types';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { FormField } from '../ui/FormField';
import { SourceBadge } from '../validation/SourceBadge';
import { es } from '../../i18n/es';
import { useAssistant } from './AssistantContext';

type Message = { id: number; role: 'user'; text: string } | { id: number; role: 'ai'; reply: AgentReply };

/**
 * Asistente conversacional acoplado a las pantallas del proyecto (FR-020–FR-025). Solo muestra
 * recomendaciones: nunca modifica artefactos. Todo el texto de la IA se pinta como texto plano.
 */
export function AssistantPanel({ projectId }: { projectId: string }) {
  const { focus } = useAssistant();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counter = useRef(0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question) return;
    setBusy(true);
    setError(null);
    setMessages((m) => [...m, { id: (counter.current += 1), role: 'user', text: question }]);
    setText('');
    try {
      const reply = await api<AgentReply>(`/projects/${projectId}/agent/chat`, {
        method: 'POST',
        body: { message: question, ...(focus ? { focus: { targetType: focus.targetType, targetId: focus.targetId } } : {}) },
      });
      setMessages((m) => [...m, { id: (counter.current += 1), role: 'ai', reply }]);
    } catch (err) {
      // Los mensajes del servidor ya aclaran que las reglas siguen funcionando.
      setError(err instanceof Error ? err.message : es.assistant.unavailable);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="panel-asistente"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-40 min-h-11 rounded-full bg-[var(--color-ai)] px-4 py-2 font-medium text-[var(--color-ai-bg)] shadow-lg"
      >
        <span aria-hidden="true">✦ </span>
        {open ? es.assistant.close : es.assistant.open}
      </button>

      <aside
        id="panel-asistente"
        aria-label={es.assistant.title}
        hidden={!open}
        className="fixed bottom-20 right-0 z-40 flex max-h-[75dvh] w-full flex-col overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl sm:right-4 sm:w-[26rem] sm:rounded-lg"
      >
        <div className="border-b border-[var(--color-border)] p-3">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {es.assistant.title} <SourceBadge source="AI_RECOMMENDATION" />
          </h2>
          <p className="text-sm text-[var(--color-muted)]">{es.assistant.intro}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">{es.assistant.privacy}</p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {es.assistant.context}: <strong>{focus ? focus.label : es.assistant.wholeProject}</strong>
          </p>
        </div>

        <div role="log" aria-live="polite" aria-label="Conversación" className="flex-1 space-y-3 overflow-y-auto p-3">
          {messages.length === 0 ? <p className="text-sm text-[var(--color-muted)]">{es.assistant.empty}</p> : null}
          {messages.map((message) =>
            message.role === 'user' ? (
              <div key={message.id} className="rounded-md bg-[var(--color-info-bg)] p-2 text-sm text-[var(--color-info)]">
                <strong>{es.assistant.you}:</strong> {message.text}
              </div>
            ) : (
              <div key={message.id} data-ai-reply className="rounded-md border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-ai)]">
                <p className="mb-1">
                  <SourceBadge source="AI_RECOMMENDATION" />
                </p>
                <p className="whitespace-pre-wrap">{message.reply.answer}</p>
                {message.reply.suggestions.length > 0 ? (
                  <>
                    <h3 className="mt-2 font-semibold">{es.assistant.suggestions}</h3>
                    <ul className="list-disc pl-5">
                      {message.reply.suggestions.map((s, i) => (
                        <li key={i}>
                          <span className="font-mono text-xs">{s.target}</span>: {s.text}
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {message.reply.referencedCriteria.length > 0 ? (
                  <p className="mt-2 text-xs">
                    {es.assistant.criteria}: {message.reply.referencedCriteria.join(', ')}
                  </p>
                ) : null}
                <p className="mt-2 text-xs">{message.reply.disclaimer}</p>
                <p className="text-xs opacity-80">
                  {es.assistant.model}: {message.reply.model}
                </p>
              </div>
            ),
          )}
          {busy ? <p role="status" className="text-sm text-[var(--color-muted)]">{es.assistant.thinking}</p> : null}
          {error ? <ErrorBanner message={error} /> : null}
        </div>

        <form onSubmit={onSubmit} noValidate className="border-t border-[var(--color-border)] p-3">
          <p className="mb-2 text-xs text-[var(--color-muted)]">{es.assistant.notGuaranteed}</p>
          <FormField
            multiline
            rows={2}
            label={es.assistant.question}
            name="pregunta"
            placeholder={es.assistant.placeholder}
            value={text}
            maxLength={2000}
            onChange={(e) => setText(e.target.value)}
          />
          <Button type="submit" disabled={busy || text.trim() === ''}>
            {es.assistant.send}
          </Button>
        </form>
      </aside>
    </>
  );
}
