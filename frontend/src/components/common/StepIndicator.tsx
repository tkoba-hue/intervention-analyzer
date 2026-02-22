'use client';

import { useProjectStore, StepStatus } from '@/store/projectStore';
import { useRouter, useParams } from 'next/navigation';

const STEP_LABELS = [
  '正規化',
  '除外マーク',
  'anchor抽出',
  'evidence確定',
  'strict判定',
  'evidence_type',
  'scope',
  'trigger',
  '文脈リンク',
  'goal_domain',
  '出力',
];

interface StepIndicatorProps {
  currentStep?: number;
}

export default function StepIndicator({ currentStep: propCurrentStep }: StepIndicatorProps) {
  const router = useRouter();
  const params = useParams();
  const { steps, currentStep: storeCurrentStep } = useProjectStore();

  const projectId = params?.id as string;
  const activeStep = propCurrentStep ?? storeCurrentStep;

  const getStepStyle = (step: number, status: StepStatus) => {
    const isActive = step === activeStep;

    if (status === 'completed') {
      return 'bg-green-500 text-white border-green-500';
    }
    if (status === 'in_progress' || isActive) {
      return 'bg-blue-500 text-white border-blue-500';
    }
    return 'bg-gray-200 text-gray-600 border-gray-300';
  };

  const getConnectorStyle = (step: number) => {
    const status = steps[step]?.status;
    if (status === 'completed') {
      return 'bg-green-500';
    }
    return 'bg-gray-300';
  };

  const handleStepClick = (step: number) => {
    if (projectId) {
      router.push(`/project/${projectId}/step/${step}`);
    }
  };

  return (
    <div className="w-full py-4 px-2">
      <div className="flex items-center justify-between">
        {STEP_LABELS.map((label, index) => {
          const step = index + 1;
          const status = steps[step]?.status || 'pending';

          return (
            <div key={step} className="flex items-center flex-1">
              <button
                onClick={() => handleStepClick(step)}
                className={`
                  flex flex-col items-center justify-center
                  w-10 h-10 rounded-full border-2
                  text-xs font-medium
                  transition-all duration-200
                  hover:scale-110 cursor-pointer
                  ${getStepStyle(step, status)}
                `}
                title={label}
              >
                {step}
              </button>
              {step < 11 && (
                <div
                  className={`flex-1 h-1 mx-1 ${getConnectorStyle(step)}`}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        {STEP_LABELS.map((label, index) => (
          <div
            key={index}
            className="flex-1 text-center text-xs text-gray-600 truncate px-1"
            title={label}
          >
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
