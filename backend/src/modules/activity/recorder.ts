import type { Tx } from '../../platform/db.js';

export interface ActivityEvent {
  projectId: string;
  actorId: string | null;
  action: string; // p. ej. project.created, sprint.created, evidence.added
  entityType: string;
  entityId?: string | null;
  /** Solo metadatos; nunca contenido personal ni textos escritos por las personas. */
  payload?: Record<string, string | number | boolean | null>;
  occurredAt: Date;
}

/** Registro de actividad de solo inserción; se llama dentro de la misma transacción del cambio. */
export const ActivityRecorder = {
  async record(tx: Tx, event: ActivityEvent): Promise<void> {
    await tx.activityLog.create({
      data: {
        projectId: event.projectId,
        actorId: event.actorId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId ?? null,
        payload: event.payload ?? {},
        occurredAt: event.occurredAt,
      },
    });
  },
};
