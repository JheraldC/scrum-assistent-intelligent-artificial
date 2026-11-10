import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TargetType } from '@scrum/shared';

export interface AssistantFocus {
  targetType: TargetType;
  targetId: string;
  label: string;
}

interface AssistantContextValue {
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

/** Guarda el artefacto en pantalla (acota el contexto) y el estado del panel lateral del asistente. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<AssistantFocus | null>(null);
  const [open, setOpenState] = useState<boolean>(() => (typeof window === 'undefined' ? true : readOpen()));
  const [draft, setDraft] = useState('');

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

  const value = useMemo(() => ({ focus, setFocus, open, setOpen, draft, setDraft, ask }), [focus, open, setOpen, draft, ask]);
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
