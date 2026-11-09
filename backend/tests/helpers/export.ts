/** Lector de CSV mínimo para las pruebas (admite comillas, comas y saltos de línea dentro de celdas). */
export function parseCsv(text: string): { header: string[]; rows: Record<string, string>[] } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: string[][] = [];
  let field = '';
  let record: string[] = [];
  let quoted = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      record.push(field);
      field = '';
    } else if (ch === '\r' && src[i + 1] === '\n') {
      record.push(field);
      records.push(record);
      record = [];
      field = '';
      i += 1;
    } else field += ch;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  const [header = [], ...rest] = records;
  return { header, rows: rest.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']))) };
}

export const DATASET_COLUMNS = {
  activities: ['activity_id', 'project_id', 'is_sample', 'occurred_at', 'user_pseudonym', 'action', 'entity_type', 'entity_id'],
  stage_durations: ['project_id', 'is_sample', 'sprint_number', 'stage_type', 'status', 'started_at', 'completed_at', 'duration_seconds'],
  validation_runs: [
    'validation_id', 'project_id', 'is_sample', 'sprint_number', 'gate_id', 'target_type', 'target_id', 'target_version',
    'attempt_no', 'status', 'passed', 'mandatory_not_met_count', 'catalog_version', 'ai_status', 'requested_by_pseudonym',
    'started_at', 'finished_at', 'duration_ms', 'has_exception', 'attempts_before_pass',
  ],
  criterion_results: ['validation_id', 'project_id', 'is_sample', 'gate_id', 'attempt_no', 'criterion_id', 'origin', 'mandatory', 'outcome'],
  exceptions: ['exception_id', 'validation_id', 'project_id', 'is_sample', 'gate_id', 'authorized_by_pseudonym', 'created_at'],
  agent_interactions: [
    'interaction_id', 'project_id', 'is_sample', 'created_at', 'user_pseudonym', 'kind', 'validation_id', 'provider', 'model',
    'prompt_version', 'model_config', 'status', 'latency_ms', 'input_tokens', 'output_tokens',
  ],
} as const;

export const TEXT_COLUMNS = {
  activities: [],
  stage_durations: [],
  validation_runs: [],
  criterion_results: ['evidence', 'explanation', 'recommendation'],
  exceptions: ['justification'],
  agent_interactions: ['question', 'answer'],
} as const;
