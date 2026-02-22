'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import StepIndicator from '@/components/common/StepIndicator';
import {
  useProjectStore,
  PhaseStepId,
  ALL_STEP_IDS,
  STEP_INFO,
  STEP_DEPENDENCIES,
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

// フェーズ式ステップIDとコンポーネントのマッピング
const STEP_COMPONENTS: Record<PhaseStepId, React.ComponentType> = {
  '1-1': Step1Normalize,
  '1-2': Step2Exclude,
  '2A-1': Step8TriggerAssign, // Trigger候補抽出（Step8の8-1相当）
  '2A-2': Step8TriggerAssign, // Trigger自動付与（Step8の8-2相当）
  '2A-3': Step8TriggerAssign, // Trigger確定（Step8の8-3相当）
  '2B-1': Step3AnchorExtract, // Evidence候補抽出
  '2B-2': Step4EvidenceConfirm, // Evidence確定
  '2B-3': Step6EvidenceType, // Evidence分類（type+scope統合）
  '3-1': Step9ContextLink,
  '3-2': Step10GoalDomain,
  '3-3': Step11Export,
};

// 次のステップを取得
const getNextStep = (current: PhaseStepId): PhaseStepId | null => {
  const stepOrder: Record<PhaseStepId, PhaseStepId | null> = {
    '1-1': '1-2',
    '1-2': null, // 分岐点（UIで2A-1と2B-1を選択）
    '2A-1': '2A-2',
    '2A-2': '2A-3',
    '2A-3': '3-1', // P3へ（ただし2B-3も完了必要）
    '2B-1': '2B-2',
    '2B-2': '2B-3',
    '2B-3': '3-1', // P3へ（ただし2A-3も完了必要）
    '3-1': '3-2',
    '3-2': '3-3',
    '3-3': null, // 最後
  };
  return stepOrder[current];
};

// 前のステップを取得
const getPrevStep = (current: PhaseStepId): PhaseStepId | null => {
  const stepOrder: Record<PhaseStepId, PhaseStepId | null> = {
    '1-1': null,
    '1-2': '1-1',
    '2A-1': '1-2',
    '2A-2': '2A-1',
    '2A-3': '2A-2',
    '2B-1': '1-2',
    '2B-2': '2B-1',
    '2B-3': '2B-2',
    '3-1': null, // 分岐から来るので戻り先は曖昧
    '3-2': '3-1',
    '3-3': '3-2',
  };
  return stepOrder[current];
};

// 旧ステップID → 新フェーズ式IDのマッピング
const OLD_TO_NEW_STEP: Record<string, PhaseStepId> = {
  '1': '1-1',
  '2': '1-2',
  '3': '2B-1',
  '4': '2B-2',
  '5': '2B-2', // strict判定は削除、確定に統合
  '6': '2B-3',
  '7': '2B-3', // scope統合
  '8': '2A-1',
  '9': '3-1',
  '10': '3-2',
  '11': '3-3',
};

export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const { projectId, projectName, setCurrentStep, steps, canProceedToStep } = useProjectStore();

  const rawStepId = params.step as string;
  const currentProjectId = params.id as string;

  // 旧IDの場合はリダイレクト
  useEffect(() => {
    if (OLD_TO_NEW_STEP[rawStepId]) {
      router.replace(`/project/${currentProjectId}/step/${OLD_TO_NEW_STEP[rawStepId]}`);
    }
  }, [rawStepId, currentProjectId, router]);

  // 旧IDの場合はリダイレクト中
  if (OLD_TO_NEW_STEP[rawStepId]) {
    return null;
  }

  const stepId = rawStepId as PhaseStepId;

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
            onClick={() => router.push(`/project/${currentProjectId}/step/1-1`)}
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

  // 分岐点（1-2完了後）の場合
  const isBranchPoint = stepId === '1-2' && currentStepCompleted;

  // P3への合流条件チェック
  const canProceedToP3 =
    steps['2A-3']?.status === 'completed' && steps['2B-3']?.status === 'completed';

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
              stepInfo.track === 'trigger'
                ? 'bg-blue-100 text-blue-700'
                : stepInfo.track === 'evidence'
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {stepInfo.phase}
          </span>
          <span className="text-gray-500 text-sm">{stepId}</span>
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
                    {dep}: {STEP_INFO[dep].label}
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
                ← {STEP_INFO[prevStep].label}
              </button>
            ) : stepId === '3-1' ? (
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/project/${currentProjectId}/step/2A-3`)}
                  className="px-4 py-2 rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  ← Trigger
                </button>
                <button
                  onClick={() => router.push(`/project/${currentProjectId}/step/2B-3`)}
                  className="px-4 py-2 rounded bg-green-100 text-green-700 hover:bg-green-200"
                >
                  ← Evidence
                </button>
              </div>
            ) : (
              <div />
            )}
          </div>

          {/* 次へボタン */}
          <div>
            {isBranchPoint ? (
              /* 分岐点: 2つのトラックへの選択肢 */
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/project/${currentProjectId}/step/2A-1`)}
                  className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                >
                  🔵 Trigger へ →
                </button>
                <button
                  onClick={() => router.push(`/project/${currentProjectId}/step/2B-1`)}
                  className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600"
                >
                  🟢 Evidence へ →
                </button>
              </div>
            ) : (stepId === '2A-3' || stepId === '2B-3') ? (
              /* P2の終点: P3への合流 */
              <div className="flex flex-col items-end gap-2">
                {canProceedToP3 ? (
                  <button
                    onClick={() => router.push(`/project/${currentProjectId}/step/3-1`)}
                    className="px-6 py-2 rounded bg-blue-500 text-white hover:bg-blue-600"
                  >
                    統合へ進む →
                  </button>
                ) : (
                  <div className="text-sm text-gray-500">
                    {stepId === '2A-3' && steps['2B-3']?.status !== 'completed' && (
                      <span>🟢 Evidence トラックの完了を待っています</span>
                    )}
                    {stepId === '2B-3' && steps['2A-3']?.status !== 'completed' && (
                      <span>🔵 Trigger トラックの完了を待っています</span>
                    )}
                  </div>
                )}
              </div>
            ) : nextStep && stepId !== '3-3' ? (
              <button
                onClick={() => router.push(`/project/${currentProjectId}/step/${nextStep}`)}
                disabled={!currentStepCompleted}
                className={`px-6 py-2 rounded ${
                  currentStepCompleted
                    ? 'bg-blue-500 text-white hover:bg-blue-600'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                {STEP_INFO[nextStep].label} →
              </button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
