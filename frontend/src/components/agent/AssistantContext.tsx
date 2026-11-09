import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { TargetType } from '@scrum/shared';

export interface AssistantFocus {
  targetType: TargetType;
  targetId: string;
  label: string;
}

interface AssistantContextValue {
  focus: AssistantFocus | null;
  setFocus: (focus: AssistantFocus | null) => void;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

/** Guarda el artefacto que la persona tiene en pantalla para acotar el contexto del asistente. */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<AssistantFocus | null>(null);
  const value = useMemo(() => ({ focus, setFocus }), [focus]);
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
