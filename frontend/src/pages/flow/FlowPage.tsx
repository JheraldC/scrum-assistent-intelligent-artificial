import { useState } from 'react';
import { api } from '../../api/client';
import { toFormFailure, type FormFailure } from '../../api/formErrors';
import type { Sprint } from '../../api/types';
import { StageStepper } from '../../components/flow/StageStepper';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorBanner } from '../../components/ui/ErrorBanner';
import { es } from '../../i18n/es';
import { useProject } from '../projects/ProjectLayout';
import { EvidenceBox } from './EvidenceBox';

/** Flujo guiado del Sprint (FR-005, FR-006, FR-007). */
export function FlowPage() {
  const { project, reload } = useProject();
  const sprint: Sprint | null = project.openSprint;
  const [failure, setFailure] = useState<FormFailure | null>(null);

  async function createSprint() {
    setFailure(null);
    try {
      await api(`/projects/${project.id}/sprints`, { method: 'POST' });
      reload();
    } catch (error) {
      setFailure(toFormFailure(error));
    }
  }

  if (!sprint) {
    return (
      <section>
        {failure ? <ErrorBanner message={failure.message} /> : null}
        <EmptyState
          title={es.flow.noSprint}
          description={es.flow.noSprintHelp}
          action={
            project.myRole === 'FACILITATOR' ? <Button onClick={() => void createSprint()}>{es.flow.createSprint}</Button> : undefined
          }
        />
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-1 text-xl font-semibold">
        {es.flow.sprintLabel} {sprint.number}
      </h2>
      <p className="mb-4 text-sm text-[var(--color-muted)]">{es.flow.guideNote}</p>
      <StageStepper
        stages={sprint.stages}
        renderStage={(stage) => (
          <EvidenceBox
            projectId={project.id}
            sprintId={sprint.id}
            stageType={stage.type}
            closed={sprint.status === 'CLOSED'}
            onChanged={reload}
          />
        )}
      />
    </section>
  );
}
