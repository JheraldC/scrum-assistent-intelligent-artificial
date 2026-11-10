import { useEffect, useState, type FormEvent } from 'react';
import { TASK_STATUSES } from '@scrum/shared';
import { api, ApiError } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { BacklogItem, Member, SprintTask, TaskStatusValue } from '../../api/types';
import { useResource } from '../../api/useResource';
import { es } from '../../i18n/es';
import { Button } from '../ui/Button';
import { ErrorBanner } from '../ui/ErrorBanner';
import { FormField } from '../ui/FormField';
import { Toast } from '../ui/Toast';

interface Props {
  projectId: string;
  sprintId: string;
  /** Elementos seleccionados para el Sprint (las tareas solo cuelgan de ellos). */
  itemIds: string[];
  /** Se llama tras un cambio para que la pantalla refresque lo que muestra. */
  onChanged?: () => void;
}

const selectClass = 'mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-base';

/**
 * Tareas opcionales del Sprint. Desglosar el trabajo y asignar responsables son opciones del equipo,
 * nunca requisitos: sin tareas la planificación y el avance funcionan igual.
 */
export function TasksPanel({ projectId, sprintId, itemIds, onChanged }: Props) {
  const url = `/projects/${projectId}/sprints/${sprintId}/tasks`;
  const tasks = useResource((signal) => api<SprintTask[]>(url, { signal }), [url]);
  const [items, setItems] = useState<BacklogItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [title, setTitle] = useState('');
  const [itemId, setItemId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    api<BacklogItem[]>(`/projects/${projectId}/backlog`).then(setItems).catch(() => undefined);
    api<Member[]>(`/projects/${projectId}/members`).then(setMembers).catch(() => undefined);
  }, [projectId]);

  const selectable = items.filter((i) => itemIds.includes(i.id));

  async function guard(action: () => Promise<unknown>, success: string) {
    setFailure(null);
    try {
      await action();
      setNotice(success);
      tasks.reload();
      onChanged?.();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'VERSION_CONFLICT') {
        setNotice(es.team.taskConflict);
        tasks.reload();
      } else setFailure(toFormFailure(error));
    }
  }

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    void guard(async () => {
      await api(url, { method: 'POST', body: { title, backlogItemId: itemId || null, assigneeId: assigneeId || null } });
      setTitle('');
    }, es.team.taskAdded);
  };

  const patch = (task: SprintTask, body: object) =>
    guard(() => api(`${url}/${task.id}`, { method: 'PATCH', body: { ...body, expectedVersion: task.version } }), es.team.taskSaved);

  return (
    <section aria-labelledby="tareas-titulo" className="mt-8" data-tasks>
      <h3 id="tareas-titulo" className="text-lg font-semibold">
        {es.team.tasks}
      </h3>
      <p className="mb-3 text-sm text-[var(--color-muted)]">{es.team.tasksHelp}</p>
      {tasks.error ? <ErrorBanner message={tasks.error.message} onRetry={tasks.reload} /> : null}
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}

      {tasks.data && tasks.data.length === 0 ? <p className="mb-3 text-sm text-[var(--color-muted)]">{es.team.noTasks}</p> : null}
      <ul className="mb-4 space-y-2">
        {(tasks.data ?? []).map((task) => (
          <li key={`${task.id}-${task.version}`} data-task={task.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-sm">
            <p className="font-medium">
              {task.title}
              {task.itemCode ? <span className="ml-2 font-mono text-xs text-[var(--color-muted)]">{task.itemCode}</span> : null}
            </p>
            {task.fromAi ? <p className="text-xs text-[var(--color-muted)]">{es.team.fromAi}</p> : null}
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <label htmlFor={`estado-${task.id}`} className="block text-xs font-medium">
                  {es.team.taskStatus}
                </label>
                <select id={`estado-${task.id}`} className={selectClass} value={task.status} onChange={(e) => void patch(task, { status: e.target.value as TaskStatusValue })}>
                  {TASK_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {es.team.statuses[st]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`resp-${task.id}`} className="block text-xs font-medium">
                  {es.team.taskAssignee}
                </label>
                <select id={`resp-${task.id}`} className={selectClass} value={task.assigneeId ?? ''} onChange={(e) => void patch(task, { assigneeId: e.target.value || null })}>
                  <option value="">{es.team.noAssignee}</option>
                  {members.map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.pseudonym}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <Button variant="secondary" className="mt-2" onClick={() => void guard(() => api(`${url}/${task.id}`, { method: 'DELETE' }), es.team.taskSaved)}>
              {es.team.deleteTask}
            </Button>
          </li>
        ))}
      </ul>

      <form onSubmit={onAdd} noValidate className="rounded-md border border-dashed border-[var(--color-border)] p-3">
        <h4 className="mb-2 font-medium">{es.team.newTask}</h4>
        <FormField label={es.team.taskTitle} name="titulo-tarea" value={title} onChange={(e) => setTitle(e.target.value)} error={failure?.fields.title} />
        <div className="mb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tarea-elemento" className="block text-sm font-medium">
              {es.team.taskItem}
            </label>
            <select id="tarea-elemento" className={selectClass} value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">{es.team.noItem}</option>
              {selectable.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.code} · {i.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="tarea-responsable" className="block text-sm font-medium">
              {es.team.taskAssignee}
            </label>
            <select id="tarea-responsable" className={selectClass} value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">{es.team.noAssignee}</option>
              {members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.pseudonym}
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button type="submit" variant="secondary" disabled={title.trim() === ''}>
          {es.team.addTask}
        </Button>
      </form>
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
