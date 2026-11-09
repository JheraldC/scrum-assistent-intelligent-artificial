import { useState, type FormEvent } from 'react';
import { ROLES, type Role } from '@scrum/shared';
import { api } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Member } from '../../api/types';
import { useResource } from '../../api/useResource';
import { Button } from '../../components/ui/Button';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { FormField } from '../../components/ui/FormField';
import { LoadingSkeleton } from '../../components/ui/LoadingSkeleton';
import { Toast } from '../../components/ui/Toast';
import { es } from '../../i18n/es';
import { useProject } from './ProjectLayout';

/** Participantes y roles por proyecto (FR-002, FR-003). Solo el Facilitador gestiona. */
export function MembersPage() {
  const { project } = useProject();
  const isFacilitator = project.myRole === 'FACILITATOR';
  const { data, error, loading, reload } = useResource(
    (signal) => api<Member[]>(`/projects/${project.id}/members`, { signal }),
    [project.id],
  );
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('PARTICIPANT');
  const [failure, setFailure] = useState<FormFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>, success?: string) {
    setFailure(null);
    try {
      await action();
      if (success) setNotice(success);
      reload();
    } catch (err) {
      setFailure(toFormFailure(err));
    }
  }

  const onAdd = (event: FormEvent) => {
    event.preventDefault();
    void run(async () => {
      await api(`/projects/${project.id}/members`, { method: 'POST', body: { email, role } });
      setEmail('');
    }, es.members.added);
  };

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">{es.members.title}</h2>
      {loading ? <LoadingSkeleton /> : null}
      {error ? <ErrorBanner message={error.message} onRetry={reload} /> : null}
      {failure && Object.keys(failure.fields).length === 0 ? <ErrorBanner message={failure.message} /> : null}
      {data ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{es.members.title}</caption>
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th scope="col" className="py-2 pr-4">{es.members.pseudonym}</th>
                {isFacilitator ? <th scope="col" className="py-2 pr-4">{es.members.email}</th> : null}
                <th scope="col" className="py-2 pr-4">{es.members.role}</th>
                {isFacilitator ? <th scope="col" className="py-2" /> : null}
              </tr>
            </thead>
            <tbody>
              {data.map((member) => (
                <tr key={member.userId} className="border-b border-[var(--color-border)]">
                  <td className="py-2 pr-4 font-mono">{member.pseudonym}</td>
                  {isFacilitator ? <td className="py-2 pr-4">{member.email}</td> : null}
                  <td className="py-2 pr-4">
                    {isFacilitator ? (
                      <select
                        aria-label={`${es.members.changeRole}: ${member.pseudonym}`}
                        value={member.role}
                        onChange={(e) =>
                          void run(() => api(`/projects/${project.id}/members/${member.userId}`, { method: 'PATCH', body: { role: e.target.value } }))
                        }
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {es.projects.roles[r]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      es.projects.roles[member.role]
                    )}
                  </td>
                  {isFacilitator ? (
                    <td className="py-2">
                      <Button
                        variant="danger"
                        onClick={() => void run(() => api(`/projects/${project.id}/members/${member.userId}`, { method: 'DELETE' }))}
                      >
                        {es.members.remove}
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {isFacilitator ? (
        <form onSubmit={onAdd} noValidate className="mt-6 max-w-md">
          <h3 className="mb-2 text-lg font-semibold">{es.members.add}</h3>
          <FormField
            label={es.auth.email}
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            hint={es.members.addHint}
            error={failure?.fields.email}
          />
          <div className="mb-4">
            <label htmlFor="rol-nuevo" className="block text-sm font-medium">
              {es.members.role}
            </label>
            <select
              id="rol-nuevo"
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className="mt-1 block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {es.projects.roles[r]}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit">{es.members.add}</Button>
        </form>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-muted)]">{es.members.onlyFacilitator}</p>
      )}
      {notice ? <Toast message={notice} onClose={() => setNotice(null)} /> : null}
    </section>
  );
}
