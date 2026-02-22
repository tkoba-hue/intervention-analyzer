'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import StepIndicator from '@/components/common/StepIndicator';
import {
  useProjectStore,
  StepId,
  ALL_STEP_IDS,
  STEP_INFO,
  STEP_DEPENDENCIES,
  PHASE_TO_STEP_MAP,
} from '@/store/projectStore';
import {
  Step1Normalize,
  Step2Exclude,
  Step3AnchorExtract,
  Step4EvidenceConfirm,
  Step6EvidenceType,
  Step8TriggerAssign,
  Step9ContextLink,
  Step10GoalDomain,
  Step11Export,
} from '@/components/steps';

// ステップIDとコンポーネントのマッピング
const STEP_COMPONENTS: Record<StepId, React.ComponentType> = {
  '1': Step1Normalize,
  '2': Step2Exclude,
  '3': Step8TriggerAssign, // Trigger候補抽出
  '4': Step8TriggerAssign, // Trigger自動付与
  '5': Step8TriggerAssign, // Trigger確定
  '6': Step3AnchorExtract, // Evidence候補抽出
  '7': Step4EvidenceConfirm, // Evidence確定
  '8': Step6EvidenceType, // Evidence分類
  '9': Step9ContextLink,
  '10': Step10GoalDomain,
  '11': Step11Export,
};

// 次のステップを取得
const getNextStep = (current: StepId): StepId | null => {
  const idx = ALL_STEP_IDS.indexOf(current);
  return idx < ALL_STEP_IDS.length - 1 ? ALL_STEP_IDS[idx + 1] : null;
};

// 前のステップを取得
const getPrevStep = (current: StepId): StepId | null => {
  const idx = ALL_STEP_IDS.indexOf(current);
  return idx > 0 ? ALL_STEP_IDS[idx - 1] : null;
};

export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const { projectId, projectName, setCurrentStep, steps, canProceedToStep } = useProjectStore();

  const rawStepId = params.step as string;
  const currentProjectId = params.id as string;

  // 旧フェーズ式IDの場合はリダイレクト
  useEffect(() => {
    if (PHASE_TO_STEP_MAP[rawStepId]) {
      router.replace(`/project/${currentProjectId}/step/${PHASE_TO_STEP_MAP[rawStepId]}`);
    }
  }, [rawStepId, currentProjectId, router]);

  // 旧IDの場合はリダイレクト中
  if (PHASE_TO_STEP_MAP[rawStepId]) {
    return null;
  }

  const stepId = rawStepId as StepId;

  // 有効なステップIDかチェック
  const isValidStepId = ALL_STEP_IDS.includes(stepId);

  useEffect(() => {
    if (isValidStepId) {
      setCurrentStep(stepId);
    }
  }, [stepId, setCurrentStep, isValidStepId]);

  // プロジェクトが読み込まれていない場合
  if (!projectId && currentProjectId !== 'new') {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">プロジェクトが見つかりません</h1>
          <p className="text-gray-600 mb-4">
            先にデータをアップロードしてください。
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            トップに戻る
          </button>
        </div>
      </div>
    );
  }

  // 無効なステップID
  if (!isValidStepId) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">無効なステップです</h1>
          <button
            onClick={() => router.push(`/project/${currentProjectId}/step/1`)}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            最初に戻る
          </button>
        </div>
      </div>
    );
  }

  const StepComponent = STEP_COMPONENTS[stepId];
  const stepInfo = STEP_INFO[stepId];
  const canProceed = canProceedToStep(stepId);

  // 未完了の依存ステップを取得
  const incompleteDeps = STEP_DEPENDENCIES[stepId].filter(
    (dep) => steps[dep]?.status !== 'completed'
  );

  // ナビゲーション
  const prevStep = getPrevStep(stepId);
  const nextStep = getNextStep(stepId);
  const currentStepCompleted = steps[stepId]?.status === 'completed';

  // トラック色
  const trackColor = stepInfo.track === 'trigger' ? 'blue' :
                     stepInfo.track === 'evidence' ? 'green' : 'gray';

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold">{projectName || '新規プロジェクト'}</h1>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              トップに戻る
            </button>
          </div>
          <StepIndicator currentStep={stepId} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4">
        {/* ステップヘッダー */}
        <div className="mb-4 flex items-center gap-3">
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              trackColor === 'blue'
                ? 'bg-blue-100 text-blue-700'
                : trackColor === 'green'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            Step {stepId}
          </span>
          <span className="text-gray-700 font-medium">{stepInfo.label}</span>
        </div>

        <div className="bg-white rounded-lg shadow">
          {!canProceed ? (
            <div className="p-8 text-center">
              <p className="text-amber-600 mb-4">
                以下のステップを完了してから進んでください:
              </p>
              <div className="flex flex-wrap justify-center gap-2 mb-4">
                {incompleteDeps.map((dep) => (
                  <button
                    key={dep}
                    onClick={() => router.push(`/project/${currentProjectId}/step/${dep}`)}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
                  >
                    Step {dep}: {STEP_INFO[dep].label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <StepComponent />
          )}
        </div>

        {/* ナビゲーション */}
        <div className="mt-6 flex justify-between items-center">
          {/* 戻るボタン */}
          <div>
            {prevStep ? (
              <button
                onClick={() => router.push(`/project/${currentProjectId}/step/${prevStep}`)}
                className="px-6 py-2 rounded bg-gray-500 text-white hover:bg-gray-600"
              >
                ← Step {prevStep}
              </button>
            ) : (
              <div />
            )}
          </div>

          {/* 次へボタン */}
          <div>
            {nextStep ? (
              <button
                onClick={() => router.push(`/project/${currentProjectId}/step/${nextStep}`)}
                disabled={!currentStepCompleted}
                className={`px-6 py-2 rounded ${
                  currentStepCompleted
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                Step {nextStep} →
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
