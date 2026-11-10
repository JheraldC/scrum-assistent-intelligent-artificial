-- Recomendaciones de IA por campo: nuevo tipo de interacción y nuevo tipo de sugerencia (aditivo).
ALTER TYPE "agent_kind" ADD VALUE IF NOT EXISTS 'RECOMMENDATION';
ALTER TYPE "suggestion_kind" ADD VALUE IF NOT EXISTS 'FIELD_CHANGE';
