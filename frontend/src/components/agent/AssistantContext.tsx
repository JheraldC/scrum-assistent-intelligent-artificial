import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { TargetType } from '@scrum/shared';
import { api } from '../../api/client';
import type { AgentReply, ArtifactTypeValue, Recommendation, Suggestion, ValidationRun } from '../../api/types';
import { es } from '../../i18n/es';

export interface AssistantFocus {
  targetType: TargetType;
  targetId: string;
  label: string;
}

/** Elemento de la conversación del panel: preguntas, respuestas, evaluaciones por reglas y recomendaciones. */
export type PanelMessage =
  | { id: number; kind: 'user'; text: string }
  | { id: number; kind: 'system'; text: string }
  | { id: number; kind: 'error'; text: string }
  | { id: number; kind: 'ai'; reply: AgentReply }
  | { id: number; kind: 'evaluation'; label: string; run: ValidationRun; artifact: ArtifactRef | null; superseded: boolean }
  | { id: number; kind: 'recommendation'; label: string; rec: Recommendation; superseded: boolean };

export interface ArtifactRef {
  artifactType: ArtifactTypeValue;
  artifactId: string;
  label: string;
}

interface AssistantContextValue {
  projectId: string;
  focus: AssistantFocus | null;
  setFocus: (focus: AssistantFocus | null) => void;
  /** Panel abierto (en móvil es un cajón; en escritorio, el panel lateral expandido). */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** Texto que otras pantallas dejan preparado en el cuadro de pregunta (la persona decide si lo envía). */
  draft: string;
  setDraft: (draft: string) => void;
  /** Abre el panel con una pregunta preparada. */
  ask: (message: string) => void;
  messages: PanelMessage[];
  pending: Suggestion[];
  busy: boolean;
  /** Envía una pregunta al asistente y muestra la respuesta en la conversación. */
  send: (message: string) => Promise<void>;
  /** Muestra en el panel el resultado de una evaluación por reglas (sin IA). */
  reportEvaluation: (run: ValidationRun, label: string, artifact?: ArtifactRef | null) => void;
  /** Solicita automáticamente recomendaciones campo por campo del artefacto y las muestra en el panel. */
  recommend: (artifact: ArtifactRef) => Promise<void>;
  removePending: (id: string) => void;
  /** Contador que sube cada vez que una persona aplica una propuesta: las pantallas se recargan con él. */
  changeCounter: number;
  notifyChanged: () => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

const OPEN_KEY = 'asistente-abierto';
const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches;

/** En escritorio el panel arranca abierto (salvo que se contrajo); en móvil el cajón siempre arranca cerrado. */
function readOpen(): boolean {
  if (!isDesktop()) return false;
  try {
    return window.localStorage.getItem(OPEN_KEY) !== 'no';
  } catch {
    return true;
  }
}

interface ProviderProps {
  projectId: string;
  /** Se invoca cuando una persona aplica una propuesta (la pantalla recarga el proyecto). */
  onProjectChanged?: () => void;
  children: ReactNode;
}

/**
 * Estado compartido del asistente: artefacto en foco, panel (abierto/cerrado) y la conversación, que
 * permanece mientras la persona navega por el proyecto. Las pantallas le envían evaluaciones y piden
 * recomendaciones; el panel las muestra. Nada de lo que llega aquí modifica datos por sí mismo.
 */
export function AssistantProvider({ projectId, onProjectChanged, children }: ProviderProps) {
  const [focus, setFocus] = useState<AssistantFocus | null>(null);
  const [open, setOpenState] = useState<boolean>(() => (typeof window === 'undefined' ? true : readOpen()));
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<PanelMessage[]>([]);
  const [pending, setPending] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [changeCounter, setChangeCounter] = useState(0);
  const counter = useRef(0);
  const nextId = () => (counter.current += 1);

  const setOpen = useCallback((value: boolean) => {
    setOpenState(value);
    if (!isDesktop()) return; // la preferencia del cajón móvil no afecta al panel de escritorio
    try {
      window.localStorage.setItem(OPEN_KEY, value ? 'si' : 'no');
    } catch {
      // Sin almacenamiento: el estado solo dura mientras la pantalla está abierta.
    }
  }, []);
  const ask = useCallback(
    (message: string) => {
      setDraft(message);
      setOpen(true);
    },
    [setOpen],
  );

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

  const push = useCallback((message: PanelMessage | PanelMessage[]) => {
    setMessages((m) => [...m, ...(Array.isArray(message) ? message : [message])]);
  }, []);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text) return;
      setOpen(true);
      setBusy(true);
      push({ id: nextId(), kind: 'user', text });
      try {
        const reply = await api<AgentReply>(`/projects/${projectId}/agent/chat`, {
          method: 'POST',
          body: { message: text, ...(focus ? { focus: { targetType: focus.targetType, targetId: focus.targetId } } : {}) },
        });
        push({ id: nextId(), kind: 'ai', reply });
        setPending((p) => [...reply.proposals.filter((n) => !p.some((x) => x.id === n.id)), ...p]);
      } catch (err) {
        // Los mensajes del servidor ya aclaran que las reglas siguen funcionando.
        push({ id: nextId(), kind: 'error', text: err instanceof Error ? err.message : es.assistant.unavailable });
      } finally {
        setBusy(false);
      }
    },
    [focus, projectId, push, setOpen],
  );

  const reportEvaluation = useCallback(
    (run: ValidationRun, label: string, artifact: ArtifactRef | null = null) => {
      setOpen(true);
      setMessages((m) => {
        // Solo la evaluación más reciente se muestra completa; las anteriores quedan como una línea.
        const older = m.map((x) => (x.kind === 'evaluation' ? { ...x, superseded: true } : x));
        return [
          ...older,
          { id: nextId(), kind: 'system', text: es.panel.evaluating(label) },
          { id: nextId(), kind: 'evaluation', label, run, artifact, superseded: false },
        ];
      });
    },
    [setOpen],
  );

  const recommend = useCallback(
    async (artifact: ArtifactRef) => {
      setOpen(true);
      setBusy(true);
      push({ id: nextId(), kind: 'user', text: es.panel.autoRequest(artifact.label) });
      try {
        const rec = await api<Recommendation>(`/projects/${projectId}/agent/recommend`, {
          method: 'POST',
          body: { artifactType: artifact.artifactType, artifactId: artifact.artifactId },
        });
        setMessages((m) => [
          ...m.map((x) => (x.kind === 'recommendation' ? { ...x, superseded: true } : x)),
          { id: nextId(), kind: 'recommendation', label: artifact.label, rec, superseded: false },
        ]);
        const inline = new Set(rec.fields.flatMap((f) => (f.suggestion ? [f.suggestion.id] : [])));
        // Las propuestas ya se ven dentro de la recomendación: no se repiten en la lista general.
        setPending((p) => [...rec.fields.flatMap((f) => (f.suggestion ? [f.suggestion] : [])).filter((n) => !p.some((x) => x.id === n.id)), ...p.filter((x) => !inline.has(x.id))].filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i));
      } catch (err) {
        push({ id: nextId(), kind: 'error', text: err instanceof Error ? err.message : es.assistant.unavailable });
      } finally {
        setBusy(false);
      }
    },
    [projectId, push, setOpen],
  );

  const removePending = useCallback((id: string) => setPending((p) => p.filter((x) => x.id !== id)), []);
  const notifyChanged = useCallback(() => {
    setChangeCounter((c) => c + 1);
    onProjectChanged?.();
  }, [onProjectChanged]);

  const value = useMemo(
    () => ({ projectId, focus, setFocus, open, setOpen, draft, setDraft, ask, messages, pending, busy, send, reportEvaluation, recommend, removePending, changeCounter, notifyChanged }),
    [projectId, focus, open, setOpen, draft, ask, messages, pending, busy, send, reportEvaluation, recommend, removePending, changeCounter, notifyChanged],
  );
  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantContextValue {
  const value = useContext(AssistantContext);
  if (!value) throw new Error('useAssistant debe usarse dentro de AssistantProvider');
  return value;
}

/** Las pantallas de artefactos declaran su foco mientras están montadas. */
export function useAssistantFocus(focus: AssistantFocus | null): void {
  const { setFocus } = useAssistant();
  const key = focus ? `${focus.targetType}:${focus.targetId}:${focus.label}` : '';
  useEffect(() => {
    setFocus(focus);
    return () => setFocus(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setFocus]);
}

/** Número que cambia cuando se aplica una propuesta: úselo como dependencia para recargar los datos de la pantalla. */
export function useAssistantChanges(): number {
  // Fuera de un proyecto (p. ej. al crearlo) no hay asistente: el contador es siempre 0.
  return useContext(AssistantContext)?.changeCounter ?? 0;
}
