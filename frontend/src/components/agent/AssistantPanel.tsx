import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../../api/client';
import type { AgentReply, ResolvedSuggestion, Suggestion } from '../../api/types';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { FormField } from '../ui/FormField';
import { SourceBadge } from '../validation/SourceBadge';
import { es } from '../../i18n/es';
import { useAssistant } from './AssistantContext';
import { SuggestionCard } from './SuggestionCard';

type Message = { id: number; role: 'user'; text: string } | { id: number; role: 'ai'; reply: AgentReply };

const WIDTH_KEY = 'asistente-ancho';
const MIN_WIDTH = 320;
const MAX_WIDTH = 640;
const DEFAULT_WIDTH = 400;

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (typeof window === 'undefined' ? true : window.matchMedia(query).matches));
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function readWidth(): number {
  try {
    const stored = Number(window.localStorage.getItem(WIDTH_KEY));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

interface Props {
  projectId: string;
  /** Se invoca tras aplicar una sugerencia (la pantalla recarga el proyecto). */
  onProjectChanged: () => void;
}

/** Contenido del asistente: conversación, contexto usado, propuestas revisables y formulario. */
function AssistantBody({ projectId, onProjectChanged }: Props) {
  const { focus, draft, setDraft } = useAssistant();
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const counter = useRef(0);

  // Las propuestas pendientes sobreviven a recargas de la pantalla.
  useEffect(() => {
    let cancelled = false;
    api<Suggestion[]>(`/projects/${projectId}/agent/suggestions?status=PROPOSED`)
      .then((list) => {
        if (!cancelled) setPending(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Otra pantalla puede dejar una pregunta preparada; la persona decide si la envía.
  useEffect(() => {
    if (draft) {
      setText(draft);
      setDraft('');
    }
  }, [draft, setDraft]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const question = text.trim();
    if (!question) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    setMessages((m) => [...m, { id: (counter.current += 1), role: 'user', text: question }]);
    setText('');
    try {
      const reply = await api<AgentReply>(`/projects/${projectId}/agent/chat`, {
        method: 'POST',
        body: { message: question, ...(focus ? { focus: { targetType: focus.targetType, targetId: focus.targetId } } : {}) },
      });
      setMessages((m) => [...m, { id: (counter.current += 1), role: 'ai', reply }]);
      setPending((p) => [...reply.proposals.filter((n) => !p.some((x) => x.id === n.id)), ...p]);
    } catch (err) {
      // Los mensajes del servidor ya aclaran que las reglas siguen funcionando.
      setError(err instanceof Error ? err.message : es.assistant.unavailable);
    } finally {
      setBusy(false);
    }
  }

  function onResolved(result: ResolvedSuggestion) {
    setPending((p) => p.filter((x) => x.id !== result.suggestion.id));
    if (result.suggestion.status === 'ACCEPTED') {
      const gate = result.revalidation ? ` ${es.panel.revalidated}: ${result.revalidation.status === 'PASSED' ? es.gate.passed : es.gate.failed}.` : '';
      setNotice(`${es.panel.applied}${gate}`);
      onProjectChanged();
    } else {
      setNotice(es.panel.discarded);
    }
  }

  return (
    <>
      <div className="border-b border-[var(--color-border)] p-3">
        <p className="text-xs text-[var(--color-muted)]">{es.assistant.intro}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">{es.assistant.privacy}</p>
        <p className="mt-1 text-xs text-[var(--color-muted)]">
          {es.assistant.context}: <strong>{focus ? focus.label : es.assistant.wholeProject}</strong>
        </p>
        <details className="mt-1 text-xs text-[var(--color-muted)]">
          <summary className="min-h-6 cursor-pointer">{es.panel.providerNotice}</summary>
          <p className="mt-1">
            Para responder, el contenido pertinente de este proyecto (datos del Sprint, Product Backlog, decisiones y fragmentos de los documentos marcados para la IA) se envía al proveedor externo de IA configurado. No se envía información de otros proyectos ni credenciales.
          </p>
        </details>
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
              <p className="mt-2 text-xs">
                <strong>{es.panel.sources}:</strong>{' '}
                {message.reply.basis === 'DOCUMENTO'
                  ? message.reply.sources.map((s) => `«${s.document}»${s.section ? `, ${s.section}` : ''}`).join('; ')
                  : es.panel.basisInference}
              </p>
              <details className="mt-1 text-xs">
                <summary className="min-h-6 cursor-pointer">{es.panel.contextUsed}</summary>
                <ul className="mt-1 list-disc pl-5">
                  {message.reply.contextUsed.projectData.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                  {message.reply.contextUsed.focus ? <li>{message.reply.contextUsed.focus}</li> : null}
                </ul>
                <p className="mt-1">
                  {es.panel.contextDocs}:{' '}
                  {message.reply.contextUsed.documents.length > 0
                    ? message.reply.contextUsed.documents.map((d) => `«${d.document}» (${d.sections.join(', ')})`).join('; ')
                    : es.panel.contextNoDocs}
                </p>
              </details>
              <p className="mt-2 text-xs">{message.reply.disclaimer}</p>
              <p className="text-xs opacity-80">
                {es.assistant.model}: {message.reply.model}
              </p>
            </div>
          ),
        )}
        {busy ? <p role="status" className="text-sm text-[var(--color-muted)]">{es.assistant.thinking}</p> : null}
        {error ? <ErrorBanner message={error} /> : null}
        {notice ? (
          <p role="status" className="rounded-md bg-[var(--color-success-bg)] p-2 text-sm text-[var(--color-success)]">
            <span aria-hidden="true">✓ </span>
            {notice}
          </p>
        ) : null}

        {pending.length > 0 ? (
          <section aria-labelledby="propuestas-titulo">
            <h3 id="propuestas-titulo" className="font-semibold">
              {es.panel.proposals} ({pending.length})
            </h3>
            <p className="mb-2 text-xs text-[var(--color-muted)]">{es.panel.proposalHelp}</p>
            <ul className="space-y-2">
              {pending.map((suggestion) => (
                <SuggestionCard key={suggestion.id} projectId={projectId} suggestion={suggestion} onResolved={onResolved} />
              ))}
            </ul>
          </section>
        ) : null}
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
    </>
  );
}

/**
 * Panel lateral persistente del asistente. En escritorio ocupa la columna derecha: se contrae y se
 * redimensiona (arrastrando o con las flechas del teclado). En móvil es un cajón deslizante que se
 * cierra con el botón o con Escape, para que el contenido principal conserve su espacio.
 */
export function AssistantDock({ projectId, onProjectChanged, children }: Props & { children: React.ReactNode }) {
  const { open, setOpen } = useAssistant();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [width, setWidth] = useState<number>(() => (typeof window === 'undefined' ? DEFAULT_WIDTH : readWidth()));
  const dragging = useRef(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);

  const clamp = (value: number) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, value));
  const commitWidth = useCallback((value: number) => {
    const next = clamp(value);
    setWidth(next);
    try {
      window.localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // Sin almacenamiento: el ancho solo dura esta visita.
    }
  }, []);

  // Cajón móvil: Escape lo cierra, el foco entra al abrir y vuelve al botón al cerrar.
  useEffect(() => {
    if (desktop || !open) return;
    drawerRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [desktop, open, setOpen]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current) commitWidth(window.innerWidth - event.clientX - 16);
  };
  const onPointerUp = () => {
    dragging.current = false;
  };
  const onResizeKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') commitWidth(width + 24);
    else if (event.key === 'ArrowRight') commitWidth(width - 24);
    else return;
    event.preventDefault();
  };

  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] p-3">
      <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
        {es.panel.title} <SourceBadge source="AI_RECOMMENDATION" />
      </h2>
      <Button variant="secondary" onClick={() => { setOpen(false); openerRef.current?.focus(); }} aria-label={desktop ? es.panel.collapse : es.panel.close}>
        <span aria-hidden="true">{desktop ? '»' : '✕'}</span>
        <span className="sr-only">{desktop ? es.panel.collapse : es.panel.close}</span>
      </Button>
    </div>
  );

  // El cuerpo permanece montado aunque el panel esté contraído: la conversación no se pierde.
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantBody projectId={projectId} onProjectChanged={onProjectChanged} />
    </div>
  );

  if (desktop) {
    return (
      <div className="lg:flex lg:items-start lg:gap-0">
        <div className="min-w-0 flex-1">{children}</div>
        {open ? (
          // Patrón WAI-ARIA «window splitter»: un separador enfocable que se mueve con las flechas.
          // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
          <div
            role="separator"
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            aria-orientation="vertical"
            aria-label={es.panel.resize}
            aria-valuemin={MIN_WIDTH}
            aria-valuemax={MAX_WIDTH}
            aria-valuenow={width}
            title={es.panel.resizeHint}
            onKeyDown={onResizeKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="mx-1 w-2 shrink-0 cursor-col-resize self-stretch rounded bg-[var(--color-border)] hover:bg-[var(--color-ai)] focus-visible:bg-[var(--color-ai)]"
          />
        ) : null}
        <aside
          id="panel-asistente"
          aria-label={es.panel.title}
          hidden={!open}
          style={{ width }}
          className="sticky top-4 flex h-[calc(100dvh-2rem)] shrink-0 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow"
        >
          {header}
          {body}
        </aside>
        {!open ? (
          <button
            ref={openerRef}
            type="button"
            aria-expanded={false}
            aria-controls="panel-asistente"
            onClick={() => setOpen(true)}
            className="sticky top-4 ml-2 min-h-11 shrink-0 self-start rounded-md bg-[var(--color-ai)] px-3 py-2 font-medium text-[var(--color-ai-bg)] shadow"
          >
            <span aria-hidden="true">✦ </span>
            {es.panel.expand}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <div>{children}</div>
      <button
        ref={openerRef}
        type="button"
        aria-expanded={open}
        aria-controls="panel-asistente"
        onClick={() => setOpen(!open)}
        className="fixed bottom-4 right-4 z-40 min-h-11 rounded-full bg-[var(--color-ai)] px-4 py-2 font-medium text-[var(--color-ai-bg)] shadow-lg"
      >
        <span aria-hidden="true">✦ </span>
        {open ? es.assistant.close : es.panel.expand}
      </button>
      <div hidden={!open} className="fixed inset-0 z-40 bg-black/40" aria-hidden="true" onClick={() => setOpen(false)} />
      <aside
        id="panel-asistente"
        ref={drawerRef}
        tabIndex={-1}
        aria-label={es.panel.title}
        hidden={!open}
        className="fixed inset-y-0 right-0 z-50 flex w-[min(100%,26rem)] flex-col overflow-hidden border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
      >
        {header}
        {body}
      </aside>
    </>
  );
}
