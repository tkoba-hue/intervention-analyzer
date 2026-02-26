import type { ChatRecord } from '@/store/projectStore';

const CSV_BOM = '\uFEFF';

type CsvRow = Record<string, string>;

type ImportMode = 'full' | 'evidence';

const COLUMN_ALIASES: Record<string, string | null> = {
  record_id_global: 'id',
  record_id_in_participant: null,
  participant_id: 'user_id',
  timestamp: 'datetime',
  datetime_jst: 'datetime',
  datetime_jst_naive: 'datetime',
  evidence_flag: 'evidence_confirm',
  evidence_flag_strict: 'evidence_confirm',
  evidence_type: 'evidence_type_final',
  trigger_type: 'trigger_type_final',
  text_norm: null,
};

// 最低限必須のカラム（これだけあればインポート可能）
const REQUIRED_COLUMNS = [
  'id',
  'datetime',
  'speaker',
  'text_raw',
];

// フルデータ形式で出力されるカラム（エクスポート用）
const FULL_DATA_COLUMNS = [
  'id',
  'datetime',
  'speaker',
  'user_id',
  'text_raw',
  'exclude_flag',
  'evidence_anchor',
  'evidence_confirm',
  'evidence_type_final',
  'scope_final',
  'goal_domain_final',
  'linked_prev_id',
  'trigger_excluded',
  'trigger_type_final',
];

const EVIDENCE_ONLY_COLUMNS = [
  'id',
  'datetime',
  'text_raw',
  'evidence_type_final',
  'scope_final',
  'goal_domain_final',
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char === '\r') {
      if (text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) {
    rows.pop();
  }

  return rows;
}

function normalizeHeaders(headers: string[]): string[] {
  if (headers.length === 0) return headers;
  const normalized = [...headers];
  normalized[0] = normalized[0]?.replace(CSV_BOM, '');
  return normalized.map((h) => h.trim());
}

function toBool(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function toNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean);
}

function csvRowsToObjects(headers: string[], rows: string[][]): CsvRow[] {
  const indexMap = new Map<string, number>();
  headers.forEach((header, idx) => {
    indexMap.set(header, idx);
  });

  return rows.map((row) => {
    const obj: CsvRow = {};
    headers.forEach((header, idx) => {
      obj[header] = row[idx] ?? '';
    });
    return obj;
  });
}

function getCsvValue(row: CsvRow, key: string): string {
  return row[key] ?? '';
}

function pickPreferredValue(row: CsvRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value.trim() !== '') return value;
  }
  return '';
}

function applyColumnAliases(row: CsvRow): CsvRow {
  const mapped: CsvRow = { ...row };

  Object.entries(COLUMN_ALIASES).forEach(([from, to]) => {
    if (!to) return;
    if (!mapped[to] || mapped[to].trim() === '') {
      const value = row[from];
      if (value !== undefined) mapped[to] = value;
    }
  });

  const datetimeValue =
    pickPreferredValue(row, ['timestamp', 'datetime_jst', 'datetime_jst_naive', 'datetime']) ||
    mapped.datetime ||
    '';
  if (datetimeValue) mapped.datetime = datetimeValue;

  const evidenceConfirmValue =
    pickPreferredValue(row, ['evidence_flag', 'evidence_flag_strict', 'evidence_confirm']) ||
    mapped.evidence_confirm ||
    '';
  if (evidenceConfirmValue) mapped.evidence_confirm = evidenceConfirmValue;

  return mapped;
}

function parseSpeaker(value: string | undefined): 'participant' | 'other' {
  return value === 'other' ? 'other' : 'participant';
}

function buildBaseRecord(row: CsvRow, overrides: Partial<ChatRecord> = {}): ChatRecord {
  const id = getCsvValue(row, 'id').trim();
  const datetime = getCsvValue(row, 'datetime').trim();
  const textRaw = getCsvValue(row, 'text_raw');

  return {
    id,
    user_id: getCsvValue(row, 'user_id').trim() || undefined,
    datetime,
    speaker: parseSpeaker(getCsvValue(row, 'speaker').trim()),
    text_raw: textRaw,
    text_norm: undefined,
    exclude_flag: toBool(getCsvValue(row, 'exclude_flag')),
    exclude_reason: undefined,
    evidence_anchor: toNumber(getCsvValue(row, 'evidence_anchor')) ?? 0,
    evidence_anchor_confidence: toNumber(getCsvValue(row, 'evidence_anchor_confidence')) ?? 0,
    evidence_anchor_patterns: undefined,
    evidence_confirm: toNumber(getCsvValue(row, 'evidence_confirm')),
    evidence_reason_if0: undefined,
    evidence_flag_strict: toBool(getCsvValue(row, 'evidence_flag_strict')),
    evidence_type_auto: undefined,
    evidence_type_confidence: toNumber(getCsvValue(row, 'evidence_type_confidence')),
    evidence_type_final: getCsvValue(row, 'evidence_type_final').trim() || undefined,
    scope_auto: undefined,
    scope_override: undefined,
    scope_final: getCsvValue(row, 'scope_final').trim() || undefined,
    trigger_excluded: toBool(getCsvValue(row, 'trigger_excluded')),
    trigger_type_auto: toList(getCsvValue(row, 'trigger_type_auto')),
    trigger_type_override: undefined,
    trigger_type_final: toList(getCsvValue(row, 'trigger_type_final')),
    trigger_type_confidence: toNumber(getCsvValue(row, 'trigger_type_confidence')),
    linked_prev_id: getCsvValue(row, 'linked_prev_id').trim() || undefined,
    linked_other_ids: toList(getCsvValue(row, 'linked_other_ids')),
    goal_domain_auto: undefined,
    goal_domain_final: getCsvValue(row, 'goal_domain_final').trim() || undefined,
    ...overrides,
  };
}

async function importAnalyzedCsv(file: File): Promise<{ records: ChatRecord[]; mode: ImportMode; count: number }> {
  const rawText = await file.text();
  const text = rawText.startsWith(CSV_BOM) ? rawText.slice(1) : rawText;
  const parsed = parseCSV(text);
  if (parsed.length === 0) throw new Error('CSVが空です');

  const headers = normalizeHeaders(parsed[0]);
  const rows = parsed.slice(1);

  const effectiveHeaders = headers
    .map((header) => {
      const alias = COLUMN_ALIASES[header];
      return alias === undefined ? header : alias;
    })
    .filter((header): header is string => Boolean(header));
  const effectiveHeaderSet = new Set(effectiveHeaders);

  const hasTriggerTypeFinal = effectiveHeaderSet.has('trigger_type_final');
  const hasEvidenceTypeFinal = effectiveHeaderSet.has('evidence_type_final');

  // 最低限必須のカラムのみチェック（evidence_type_final は必須から外す）
  const missing = REQUIRED_COLUMNS.filter((col) => !effectiveHeaderSet.has(col));
  if (missing.length > 0) {
    throw new Error(`必須カラムが不足しています: ${missing.join(', ')}`);
  }

  const rowObjects = csvRowsToObjects(headers, rows)
    .map((row) => applyColumnAliases(row))
    .filter((row) => Object.values(row).some((value) => value.trim() !== ''));

  if (rowObjects.length === 0) {
    throw new Error('CSVにデータ行がありません');
  }

  if (hasTriggerTypeFinal) {
    const records = rowObjects.map((row) =>
      buildBaseRecord(row, {
        speaker: parseSpeaker(getCsvValue(row, 'speaker').trim()),
        text_raw: getCsvValue(row, 'text_raw'),
      })
    );
    return { records, mode: 'full', count: records.length };
  }

  const records = rowObjects.map((row) =>
    buildBaseRecord(row, {
      speaker: 'participant',
      user_id: getCsvValue(row, 'user_id').trim() || undefined,
      exclude_flag: false,
      evidence_anchor: 1,
      evidence_anchor_confidence: 1,
      evidence_confirm: 1,
      evidence_flag_strict: false,
      trigger_excluded: false,
      trigger_type_auto: [],
      trigger_type_final: [],
      linked_other_ids: [],
    })
  );

  const recordMap = new Map(records.map((record) => [record.id, record]));
  const triggerTypeByLink = new Map<string, string[]>();

  rowObjects.forEach((row) => {
    const linkedId = getCsvValue(row, 'linked_prev_id').trim();
    const linkedTypes = toList(getCsvValue(row, 'linked_trigger_type'));
    if (linkedId && linkedTypes.length > 0) {
      triggerTypeByLink.set(linkedId, linkedTypes);
    }
  });

  records.forEach((record) => {
    if (!record.linked_prev_id) return;
    const target = recordMap.get(record.linked_prev_id);
    if (!target) {
      record.linked_prev_id = undefined;
      return;
    }
    target.speaker = 'other';
    const linkedTypes = triggerTypeByLink.get(target.id);
    if (linkedTypes && target.trigger_type_final.length === 0) {
      target.trigger_type_final = linkedTypes;
    }
  });

  return { records, mode: 'evidence', count: records.length };
}

export {
  COLUMN_ALIASES,
  EVIDENCE_ONLY_COLUMNS,
  FULL_DATA_COLUMNS,
  CSV_BOM,
  importAnalyzedCsv,
  type ImportMode,
};
