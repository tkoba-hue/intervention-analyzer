'use client';

import { useProjectStore, PhaseStepId, STEP_INFO, STEP_DEPENDENCIES } from '@/store/projectStore';
import { useRouter, useParams } from 'next/navigation';

interface StepIndicatorProps {
  currentStep?: PhaseStepId;
}

// トラック別のステップ
const P1_STEPS: PhaseStepId[] = ['1-1', '1-2'];
const P2A_STEPS: PhaseStepId[] = ['2A-1', '2A-2', '2A-3'];
const P2B_STEPS: PhaseStepId[] = ['2B-1', '2B-2', '2B-3'];
const P3_STEPS: PhaseStepId[] = ['3-1', '3-2', '3-3'];

export default function StepIndicator({ currentStep: propCurrentStep }: StepIndicatorProps) {
  const router = useRouter();
  const params = useParams();
  const { steps, currentStep: storeCurrentStep, canProceedToStep } = useProjectStore();

  const projectId = params?.id as string;
  const activeStep = propCurrentStep ?? storeCurrentStep;

  const getStepStyle = (stepId: PhaseStepId) => {
    const status = steps[stepId]?.status || 'pending';
    const isActive = stepId === activeStep;
    const info = STEP_INFO[stepId];
    const canProceed = canProceedToStep(stepId);

    let bgColor = 'bg-gray-200';
    let textColor = 'text-gray-500';

    if (status === 'completed') {
      if (info.track === 'trigger') {
        bgColor = 'bg-blue-500';
      } else if (info.track === 'evidence') {
        bgColor = 'bg-green-500';
      } else {
        bgColor = 'bg-gray-500';
      }
      textColor = 'text-white';
    } else if (status === 'in_progress' || isActive) {
      if (info.track === 'trigger') {
        bgColor = 'bg-blue-300';
      } else if (info.track === 'evidence') {
        bgColor = 'bg-green-300';
      } else {
        bgColor = 'bg-gray-400';
      }
      textColor = 'text-white';
    } else if (!canProceed) {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-300';
    }

    return `${bgColor} ${textColor}`;
  };

  const handleStepClick = (stepId: PhaseStepId) => {
    if (projectId && canProceedToStep(stepId)) {
      router.push(`/project/${projectId}/step/${stepId}`);
    }
  };

  const renderStep = (stepId: PhaseStepId) => {
    const info = STEP_INFO[stepId];
    const canProceed = canProceedToStep(stepId);
    const status = steps[stepId]?.status;

    return (
      <button
        key={stepId}
        onClick={() => handleStepClick(stepId)}
        disabled={!canProceed}
        className={`
          px-2 py-1 rounded text-xs font-medium
          ${canProceed ? 'hover:opacity-80 cursor-pointer' : 'cursor-not-allowed opacity-60'}
          ${getStepStyle(stepId)}
        `}
        title={`${stepId}: ${info.label}`}
      >
        {status === 'completed' ? '✓' : ''}{info.shortLabel}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs">
      {/* P1 */}
      <span className="text-gray-500 font-medium mr-1">P1</span>
      {P1_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">→</span>

      {/* P2 Trigger */}
      <span className="text-blue-500 font-medium mr-1">P2 Trigger</span>
      {P2A_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">/</span>

      {/* P2 Evidence */}
      <span className="text-green-500 font-medium mr-1">P2 Evidence</span>
      {P2B_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">→</span>

      {/* P3 */}
      <span className="text-gray-500 font-medium mr-1">P3</span>
      {P3_STEPS.map(renderStep)}
    </div>
  );
}
