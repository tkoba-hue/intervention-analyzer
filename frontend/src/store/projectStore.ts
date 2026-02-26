import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StepStatus = 'pending' | 'in_progress' | 'completed';

// シンプルなステップID（1〜11）
export type StepId = '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | '11';

// 後方互換性のためのエイリアス
export type PhaseStepId = StepId;

// 全ステップID一覧
export const ALL_STEP_IDS: StepId[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'];

// 依存関係マップ（線形）
export const STEP_DEPENDENCIES: Record<StepId, StepId[]> = {
  '1': [],
  '2': ['1'],
  '3': ['2'],
  '4': ['3'],
  '5': ['4'],
  '6': ['5'],
  '7': ['6'],
  '8': ['7'],
  '9': ['8'],
  '10': ['9'],
  '11': ['10'],
};

// ステップ情報
export const STEP_INFO: Record<StepId, {
  label: string;
  shortLabel: string;
  track: 'common' | 'trigger' | 'evidence' | 'integration';
}> = {
  '1': { label: '正規化', shortLabel: '正規化', track: 'common' },
  '2': { label: '除外マーク', shortLabel: '除外', track: 'common' },
  '3': { label: 'Trigger候補抽出', shortLabel: '候補', track: 'trigger' },
  '4': { label: 'Trigger自動付与', shortLabel: '自動', track: 'trigger' },
  '5': { label: 'Trigger確定', shortLabel: '確定', track: 'trigger' },
  '6': { label: 'Evidence候補抽出', shortLabel: '候補', track: 'evidence' },
  '7': { label: 'Evidence確定', shortLabel: '確定', track: 'evidence' },
  '8': { label: 'Evidence分類', shortLabel: '分類', track: 'evidence' },
  '9': { label: '文脈リンク', shortLabel: 'リンク', track: 'integration' },
  '10': { label: 'ゴールドメイン', shortLabel: 'ゴール', track: 'integration' },
  '11': { label: '出力', shortLabel: '出力', track: 'integration' },
};

// 旧フェーズ式IDからの変換マップ
export const PHASE_TO_STEP_MAP: Record<string, StepId> = {
  '1-1': '1',
  '1-2': '2',
  '2A-1': '3',
  '2A-2': '4',
  '2A-3': '5',
  '2B-1': '6',
  '2B-2': '7',
  '2B-3': '8',
  '3-1': '9',
  '3-2': '10',
  '3-3': '11',
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
  currentStep: StepId;
  steps: Record<StepId, StepState>;
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
  setCurrentStep: (step: StepId) => void;
  updateStepStatus: (step: StepId, status: StepStatus) => void;
  updateStepProgress: (step: StepId, processed: number, total: number) => void;
  setData: (data: ChatRecord[]) => void;
  updateRecord: (id: string, updates: Partial<ChatRecord>) => void;
  bulkUpdateRecords: (updates: Array<{ id: string } & Partial<ChatRecord>>) => void;
  setColumnMapping: (mapping: ProjectState['columnMapping']) => void;
  canProceedToStep: (step: StepId) => boolean;
  completeAllSteps: () => void;
  reset: () => void;
}

const createInitialSteps = (): Record<StepId, StepState> => {
  const steps: Partial<Record<StepId, StepState>> = {};
  for (const stepId of ALL_STEP_IDS) {
    steps[stepId] = {
      status: 'pending',
      processedCount: 0,
      totalCount: 0,
      lastUpdated: null,
    };
  }
  return steps as Record<StepId, StepState>;
};

const initialSteps = createInitialSteps();

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectId: null,
      projectName: '',
      currentStep: '1',
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

      completeAllSteps: () =>
        set((state) => {
          const completedSteps: Record<StepId, StepState> = {} as Record<StepId, StepState>;
          for (const stepId of ALL_STEP_IDS) {
            completedSteps[stepId] = {
              ...state.steps[stepId],
              status: 'completed',
              lastUpdated: new Date().toISOString(),
            };
          }
          return { steps: completedSteps };
        }),

      reset: () =>
        set({
          projectId: null,
          projectName: '',
          currentStep: '1',
          steps: createInitialSteps(),
          data: [],
          columnMapping: null,
        }),
    }),
    {
      name: 'intervention-analyzer-project-v3',
    }
  )
);
