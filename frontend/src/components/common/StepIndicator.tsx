'use client';

import { useProjectStore, StepId, STEP_INFO } from '@/store/projectStore';
import { useRouter, useParams } from 'next/navigation';

interface StepIndicatorProps {
  currentStep?: StepId;
}

// トラック別のステップ
const COMMON_STEPS: StepId[] = ['1', '2'];
const TRIGGER_STEPS: StepId[] = ['3', '4', '5'];
const EVIDENCE_STEPS: StepId[] = ['6', '7', '8'];
const INTEGRATION_STEPS: StepId[] = ['9', '10', '11'];

export default function StepIndicator({ currentStep: propCurrentStep }: StepIndicatorProps) {
  const router = useRouter();
  const params = useParams();
  const { steps, currentStep: storeCurrentStep, canProceedToStep } = useProjectStore();

  const projectId = params?.id as string;
  const activeStep = propCurrentStep ?? storeCurrentStep;

  const getStepStyle = (stepId: StepId) => {
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

  const handleStepClick = (stepId: StepId) => {
    if (projectId && canProceedToStep(stepId)) {
      router.push(`/project/${projectId}/step/${stepId}`);
    }
  };

  const renderStep = (stepId: StepId) => {
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
        title={`Step ${stepId}: ${info.label}`}
      >
        {status === 'completed' && 'v'}{stepId}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-1 flex-wrap text-xs">
      {/* Common */}
      {COMMON_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">-&gt;</span>

      {/* Trigger */}
      <span className="text-blue-500 font-medium mr-1">Trigger</span>
      {TRIGGER_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">-&gt;</span>

      {/* Evidence */}
      <span className="text-green-500 font-medium mr-1">Evidence</span>
      {EVIDENCE_STEPS.map(renderStep)}

      <span className="text-gray-300 mx-1">-&gt;</span>

      {/* Integration */}
      {INTEGRATION_STEPS.map(renderStep)}
    </div>
  );
}
