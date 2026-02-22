import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StepStatus = 'pending' | 'in_progress' | 'completed';

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
  currentStep: number;
  steps: Record<number, StepState>;
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
  setCurrentStep: (step: number) => void;
  updateStepStatus: (step: number, status: StepStatus) => void;
  updateStepProgress: (step: number, processed: number, total: number) => void;
  setData: (data: ChatRecord[]) => void;
  updateRecord: (id: string, updates: Partial<ChatRecord>) => void;
  bulkUpdateRecords: (updates: Array<{ id: string } & Partial<ChatRecord>>) => void;
  setColumnMapping: (mapping: ProjectState['columnMapping']) => void;
  reset: () => void;
}

const initialSteps: Record<number, StepState> = {};
for (let i = 1; i <= 11; i++) {
  initialSteps[i] = {
    status: 'pending',
    processedCount: 0,
    totalCount: 0,
    lastUpdated: null,
  };
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set) => ({
      projectId: null,
      projectName: '',
      currentStep: 1,
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

      reset: () =>
        set({
          projectId: null,
          projectName: '',
          currentStep: 1,
          steps: initialSteps,
          data: [],
          columnMapping: null,
        }),
    }),
    {
      name: 'intervention-analyzer-project',
    }
  )
);
