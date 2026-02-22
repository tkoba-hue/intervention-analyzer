import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StepStatus = 'pending' | 'in_progress' | 'completed';

// フェーズ式ステップID
export type PhaseStepId =
  | '1-1' | '1-2'           // P1 共通
  | '2A-1' | '2A-2' | '2A-3' // P2A Trigger
  | '2B-1' | '2B-2' | '2B-3' // P2B Evidence
  | '3-1' | '3-2' | '3-3';   // P3 統合

// 全ステップID一覧
export const ALL_STEP_IDS: PhaseStepId[] = [
  '1-1', '1-2',
  '2A-1', '2A-2', '2A-3',
  '2B-1', '2B-2', '2B-3',
  '3-1', '3-2', '3-3',
];

// 依存関係マップ
export const STEP_DEPENDENCIES: Record<PhaseStepId, PhaseStepId[]> = {
  '1-1': [],
  '1-2': ['1-1'],
  // P2A Trigger（3工程）
  '2A-1': ['1-2'],
  '2A-2': ['2A-1'],
  '2A-3': ['2A-2'],
  // P2B Evidence（3工程）
  '2B-1': ['1-2'],
  '2B-2': ['2B-1'],
  '2B-3': ['2B-2'],
  // P3 統合
  '3-1': ['2A-3', '2B-3'],
  '3-2': ['3-1'],
  '3-3': ['3-2'],
};

// ステップ情報
export const STEP_INFO: Record<PhaseStepId, {
  phase: string;
  label: string;
  shortLabel: string;
  track: 'common' | 'trigger' | 'evidence' | 'integration';
}> = {
  '1-1': { phase: 'P1', label: '正規化', shortLabel: '正規化', track: 'common' },
  '1-2': { phase: 'P1', label: '除外マーク', shortLabel: '除外', track: 'common' },
  '2A-1': { phase: 'P2A', label: '候補抽出', shortLabel: '候補', track: 'trigger' },
  '2A-2': { phase: 'P2A', label: '自動付与', shortLabel: '自動', track: 'trigger' },
  '2A-3': { phase: 'P2A', label: '確定', shortLabel: '確定', track: 'trigger' },
  '2B-1': { phase: 'P2B', label: '候補抽出', shortLabel: '候補', track: 'evidence' },
  '2B-2': { phase: 'P2B', label: '確定', shortLabel: '確定', track: 'evidence' },
  '2B-3': { phase: 'P2B', label: '分類', shortLabel: '分類', track: 'evidence' },
  '3-1': { phase: 'P3', label: '文脈リンク', shortLabel: 'リンク', track: 'integration' },
  '3-2': { phase: 'P3', label: 'ゴールドメイン', shortLabel: 'ゴール', track: 'integration' },
  '3-3': { phase: 'P3', label: '出力', shortLabel: '出力', track: 'integration' },
};

// 旧ステップ番号との対応（互換性維持）
export const LEGACY_STEP_MAP: Record<number, PhaseStepId> = {
  1: '1-1',
  2: '1-2',
  3: '2B-1',
  4: '2B-2',
  // 5: strict判定は削除
  6: '2B-3', // type + scope統合
  7: '2B-3', // scopeは2B-3に統合
  8: '2A-1', // trigger工程の開始
  9: '3-1',
  10: '3-2',
  11: '3-3',
};

export interface StepState {
  status: StepStatus;
  processedCount: number;
  totalCount: number;
  lastUpdated: string | null;
}

export interface ChatRecord {
  id: string;
  user_id?: string;
  datetime: string;
  speaker: 'participant' | 'other';
  text_raw: string;
  text_norm?: string;
  exclude_flag: boolean;
  exclude_reason?: string;
  evidence_anchor: number;
  evidence_anchor_confidence: number;
  evidence_anchor_patterns?: string[];
  evidence_confirm?: number;
  evidence_reason_if0?: string;
  evidence_flag_strict: boolean;
  evidence_type_auto?: string;
  evidence_type_confidence?: number;
  evidence_type_final?: string;
  scope_auto?: string;
  scope_override?: string;
  scope_final?: string;
  trigger_excluded?: boolean;
  trigger_type_auto: string[];
  trigger_type_override?: string[];
  trigger_type_final: string[];
  trigger_type_confidence?: number;
  linked_prev_id?: string;
  linked_other_ids: string[];
  goal_domain_auto?: string;
  goal_domain_final?: string;
}

interface ProjectState {
  projectId: string | null;
  projectName: string;
  currentStep: PhaseStepId;
  steps: Record<PhaseStepId, StepState>;
  data: ChatRecord[];
  columnMapping: {
    id: string;
    datetime: string;
    speaker: string;
    text: string;
    speakerParticipantValue: string;
    speakerOtherValue: string;
    userId?: string;
  } | null;

  // Actions
  setProject: (id: string, name: string) => void;
  setCurrentStep: (step: PhaseStepId) => void;
  updateStepStatus: (step: PhaseStepId, status: StepStatus) => void;
  updateStepProgress: (step: PhaseStepId, processed: number, total: number) => void;
  setData: (data: ChatRecord[]) => void;
  updateRecord: (id: string, updates: Partial<ChatRecord>) => void;
  bulkUpdateRecords: (updates: Array<{ id: string } & Partial<ChatRecord>>) => void;
  setColumnMapping: (mapping: ProjectState['columnMapping']) => void;
  canProceedToStep: (step: PhaseStepId) => boolean;
  reset: () => void;
}

const createInitialSteps = (): Record<PhaseStepId, StepState> => {
  const steps: Partial<Record<PhaseStepId, StepState>> = {};
  for (const stepId of ALL_STEP_IDS) {
    steps[stepId] = {
      status: 'pending',
      processedCount: 0,
      totalCount: 0,
      lastUpdated: null,
    };
  }
  return steps as Record<PhaseStepId, StepState>;
};

const initialSteps = createInitialSteps();

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectId: null,
      projectName: '',
      currentStep: '1-1',
      steps: initialSteps,
      data: [],
      columnMapping: null,

      setProject: (id, name) => set({ projectId: id, projectName: name }),

      setCurrentStep: (step) => set({ currentStep: step }),

      updateStepStatus: (step, status) =>
        set((state) => ({
          steps: {
            ...state.steps,
            [step]: {
              ...state.steps[step],
              status,
              lastUpdated: new Date().toISOString(),
            },
          },
        })),

      updateStepProgress: (step, processed, total) =>
        set((state) => ({
          steps: {
            ...state.steps,
            [step]: {
              ...state.steps[step],
              processedCount: processed,
              totalCount: total,
              lastUpdated: new Date().toISOString(),
            },
          },
        })),

      setData: (data) => set({ data }),

      updateRecord: (id, updates) =>
        set((state) => ({
          data: state.data.map((record) =>
            record.id === id ? { ...record, ...updates } : record
          ),
        })),

      bulkUpdateRecords: (updates) =>
        set((state) => {
          const updateMap = new Map(updates.map((u) => [u.id, u]));
          return {
            data: state.data.map((record) => {
              const update = updateMap.get(record.id);
              return update ? { ...record, ...update } : record;
            }),
          };
        }),

      setColumnMapping: (mapping) => set({ columnMapping: mapping }),

      canProceedToStep: (step) => {
        const state = get();
        const dependencies = STEP_DEPENDENCIES[step];

        // 依存がなければ進める
        if (dependencies.length === 0) return true;

        // 全ての依存が完了しているか確認
        return dependencies.every(
          (dep) => state.steps[dep]?.status === 'completed'
        );
      },

      reset: () =>
        set({
          projectId: null,
          projectName: '',
          currentStep: '1-1',
          steps: createInitialSteps(),
          data: [],
          columnMapping: null,
        }),
    }),
    {
      name: 'intervention-analyzer-project-v2',
    }
  )
);
