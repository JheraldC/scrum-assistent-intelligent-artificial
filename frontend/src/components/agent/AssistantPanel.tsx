import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { api } from '../../api/client';
import type { ResolvedSuggestion } from '../../api/types';
import { Button } from '../ui/Button';
import { InfoTip } from '../ui/InfoTip';
import { es } from '../../i18n/es';
import { useAssistant } from './AssistantContext';
import { ChatReplyCard, EvaluationCard, RecommendationCard } from './PanelCards';
import { SuggestionCard } from './SuggestionCard';

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

/** Conversación del asistente: preguntas, respuestas, evaluaciones por reglas, recomendaciones y propuestas. */
function AssistantBody() {
  const { projectId, focus, draft, setDraft, messages, pending, busy, send, removePending, notifyChanged, recommend } = useAssistant();
  const [text, setText] = useState('');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Otra pantalla puede dejar una pregunta preparada; la persona decide si la envía.
  useEffect(() => {
    if (draft) {
      setText(draft);
      setDraft('');
      inputRef.current?.focus();
    }
  }, [draft, setDraft]);

  // La conversación se desplaza al último mensaje.
  useEffect(() => {
    logRef.current?.scrollTo?.({ top: logRef.current.scrollHeight });
  }, [messages.length, busy, notice]);

  async function submit() {
    const question = text.trim();
    if (!question || busy) return;
    setText('');
    setNotice(null);
    await send(question);
  }
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void submit();
  };
  // Enter envía; Mayús+Enter inserta un salto de línea (no se envía mientras se compone texto con IME).
  const onKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void submit();
    }
  };

  function onResolved(result: ResolvedSuggestion) {
    removePending(result.suggestion.id);
    if (result.suggestion.status === 'ACCEPTED') {
      const gate = result.revalidation ? ` ${es.panel.revalidated}: ${result.revalidation.status === 'PASSED' ? es.gate.passed : es.gate.failed}.` : '';
      setNotice({ ok: true, text: `${es.panel.applied}${gate}` });
      notifyChanged();
    } else {
      setNotice({ ok: true, text: es.panel.discarded });
    }
  }

  // Las propuestas que ya se ven dentro de una recomendación no se repiten abajo.
  const inline = new Set(messages.flatMap((m) => (m.kind === 'recommendation' && !m.superseded ? m.rec.fields.flatMap((f) => (f.suggestion ? [f.suggestion.id] : [])) : [])));
  const loose = pending.filter((x) => !inline.has(x.id));
  const modifying = loose.filter((x) => x.actionable);
  const informative = loose.filter((x) => !x.actionable);

  async function discardAll() {
    setDiscarding(true);
    for (const suggestion of loose) {
      try {
        await api(`/projects/${projectId}/agent/suggestions/${suggestion.id}/resolve`, { method: 'POST', body: { action: 'DISCARD' } });
        removePending(suggestion.id);
      } catch {
        // Si una ya fue resuelta por otra persona, se quita igualmente de la lista al recargar.
        removePending(suggestion.id);
      }
    }
    setDiscarding(false);
    setNotice({ ok: true, text: es.panel.allDiscarded });
  }

  return (
    <>
      <p className="border-b border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-muted)]">
        {es.assistant.context}: <strong className="text-[var(--color-text)]">{focus ? focus.label : es.assistant.wholeProject}</strong>
      </p>

      <div ref={logRef} role="log" aria-live="polite" aria-label="Conversación" className="flex-1 space-y-2 overflow-y-auto p-3">
        {messages.length === 0 && loose.length === 0 ? <p className="text-sm text-[var(--color-muted)]">{es.assistant.empty}</p> : null}
        {messages.map((message) => {
          switch (message.kind) {
            case 'user':
              return (
                <div key={message.id} data-user-message className="ml-8 rounded-lg rounded-tr-none bg-[var(--color-primary)] p-2 text-sm text-[var(--color-primary-contrast)]">
                  <span className="sr-only">{es.assistant.you}: </span>
                  <span className="whitespace-pre-wrap">{message.text}</span>
                </div>
              );
            case 'system':
              return (
                <p key={message.id} className="text-center text-xs text-[var(--color-muted)]">
                  {message.text}
                </p>
              );
            case 'error':
              return (
                <p key={message.id} role="alert" className="mr-6 rounded-lg border-2 border-[var(--color-danger)] bg-[var(--color-danger-bg)] p-2 text-sm font-medium text-[var(--color-danger)]">
                  <span aria-hidden="true">⚠ </span>
                  {message.text}
                </p>
              );
            case 'evaluation':
              return <EvaluationCard key={message.id} message={message} onRecommend={(a) => void recommend(a)} />;
            case 'recommendation':
              return <RecommendationCard key={message.id} message={message} projectId={projectId} onResolved={onResolved} />;
            case 'ai':
              return <ChatReplyCard key={message.id} reply={message.reply} />;
          }
        })}
        {busy ? (
          <p role="status" className="mr-6 rounded-lg border border-[var(--color-ai)] bg-[var(--color-ai-bg)] p-2 text-sm text-[var(--color-ai)]">
            {es.assistant.thinking}
          </p>
        ) : null}
        {notice ? (
          <p role="status" className="rounded-md bg-[var(--color-success-bg)] p-2 text-sm text-[var(--color-success)]">
            <span aria-hidden="true">✓ </span>
            {notice.text}
          </p>
        ) : null}

        {loose.length > 0 ? (
          <section aria-labelledby="propuestas-titulo" className="rounded-lg border border-[var(--color-border)] p-2">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 id="propuestas-titulo" className="flex items-center gap-2 text-sm font-semibold">
                {es.panel.proposals} ({loose.length}) <InfoTip text={es.panel.proposalHelp} />
              </h3>
              <Button size="sm" variant="secondary" disabled={discarding} onClick={() => void discardAll()}>
                {es.panel.discardAll}
              </Button>
            </div>
            {modifying.length > 0 ? (
              <>
                <p className="mb-1 text-xs font-medium text-[var(--color-muted)]">{es.panel.modifying}</p>
                <ul className="space-y-2">
                  {modifying.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} projectId={projectId} suggestion={suggestion} onResolved={onResolved} />
                  ))}
                </ul>
              </>
            ) : null}
            {informative.length > 0 ? (
              <>
                <p className="mb-1 mt-2 text-xs font-medium text-[var(--color-muted)]">{es.panel.informativeTitle}</p>
                <ul className="space-y-2">
                  {informative.map((suggestion) => (
                    <SuggestionCard key={suggestion.id} projectId={projectId} suggestion={suggestion} onResolved={onResolved} />
                  ))}
                </ul>
              </>
            ) : null}
          </section>
        ) : null}
      </div>

      <form onSubmit={onSubmit} noValidate className="flex items-end gap-2 border-t border-[var(--color-border)] p-2">
        <textarea
          ref={inputRef}
          aria-label={es.assistant.question}
          title={es.panel.enterHint}
          rows={2}
          maxLength={2000}
          placeholder={es.assistant.placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          className="block min-h-11 w-full flex-1 resize-none rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)]"
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
export function AssistantDock({ children }: { children: React.ReactNode }) {
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
    <div className="flex items-center justify-between gap-2 border-b border-[var(--color-border)] px-3 py-2">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <span aria-hidden="true" className="text-[var(--color-ai)]">
          ✦
        </span>
        {es.panel.title}
        <InfoTip text={es.panel.about} />
      </h2>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setOpen(false);
          openerRef.current?.focus();
        }}
        aria-label={desktop ? es.panel.collapse : es.panel.close}
      >
        <span aria-hidden="true">{desktop ? '»' : '✕'}</span>
      </Button>
    </div>
  );

  // El cuerpo permanece montado aunque el panel esté contraído: la conversación no se pierde.
  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <AssistantBody />
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
            className="mx-1 w-1.5 shrink-0 cursor-col-resize self-stretch rounded bg-[var(--color-border)] hover:bg-[var(--color-ai)] focus-visible:bg-[var(--color-ai)]"
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
