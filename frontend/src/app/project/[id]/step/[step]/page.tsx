'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import StepIndicator from '@/components/common/StepIndicator';
import { useProjectStore } from '@/store/projectStore';
import {
  Step1Normalize,
  Step2Exclude,
  Step3AnchorExtract,
  Step4EvidenceConfirm,
  Step5StrictFlag,
  Step6EvidenceType,
  Step7Scope,
  Step8TriggerAssign,
  Step9ContextLink,
  Step10GoalDomain,
  Step11Export,
} from '@/components/steps';

const STEP_COMPONENTS: Record<number, React.ComponentType> = {
  1: Step1Normalize,
  2: Step2Exclude,
  3: Step3AnchorExtract,
  4: Step4EvidenceConfirm,
  5: Step5StrictFlag,
  6: Step6EvidenceType,
  7: Step7Scope,
  8: Step8TriggerAssign,
  9: Step9ContextLink,
  10: Step10GoalDomain,
  11: Step11Export,
};

export default function StepPage() {
  const params = useParams();
  const router = useRouter();
  const { projectId, projectName, setCurrentStep, steps } = useProjectStore();

  const stepNumber = parseInt(params.step as string, 10);
  const currentProjectId = params.id as string;

  useEffect(() => {
    if (stepNumber >= 1 && stepNumber <= 11) {
      setCurrentStep(stepNumber);
    }
  }, [stepNumber, setCurrentStep]);

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

  const StepComponent = STEP_COMPONENTS[stepNumber];

  if (!StepComponent) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">無効なステップです</h1>
          <button
            onClick={() => router.push(`/project/${currentProjectId}/step/1`)}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Step 1 に戻る
          </button>
        </div>
      </div>
    );
  }

  const canProceed = stepNumber === 1 || steps[stepNumber - 1]?.status === 'completed';

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
          <StepIndicator currentStep={stepNumber} />
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-4">
        <div className="bg-white rounded-lg shadow">
          {!canProceed && stepNumber > 1 ? (
            <div className="p-8 text-center">
              <p className="text-amber-600 mb-4">
                Step {stepNumber - 1} を完了してから進んでください。
              </p>
              <button
                onClick={() => router.push(`/project/${currentProjectId}/step/${stepNumber - 1}`)}
                className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Step {stepNumber - 1} に戻る
              </button>
            </div>
          ) : (
            <StepComponent />
          )}
        </div>

        <div className="mt-6 flex justify-between">
          <button
            onClick={() => router.push(`/project/${currentProjectId}/step/${stepNumber - 1}`)}
            disabled={stepNumber <= 1}
            className={`px-6 py-2 rounded ${
              stepNumber <= 1
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-gray-500 text-white hover:bg-gray-600'
            }`}
          >
            前のステップ
          </button>
          <button
            onClick={() => router.push(`/project/${currentProjectId}/step/${stepNumber + 1}`)}
            disabled={stepNumber >= 11 || steps[stepNumber]?.status !== 'completed'}
            className={`px-6 py-2 rounded ${
              stepNumber >= 11 || steps[stepNumber]?.status !== 'completed'
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            次のステップ
          </button>
        </div>
      </main>
    </div>
  );
}
