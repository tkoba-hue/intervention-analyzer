'use client';

import { useProjectStore, PhaseStepId, STEP_INFO, ALL_STEP_IDS, STEP_DEPENDENCIES } from '@/store/projectStore';
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

    // ベース色
    let bgColor = 'bg-gray-200';
    let textColor = 'text-gray-500';
    let borderColor = 'border-gray-300';

    if (status === 'completed') {
      if (info.track === 'trigger') {
        bgColor = 'bg-blue-500';
        borderColor = 'border-blue-500';
      } else if (info.track === 'evidence') {
        bgColor = 'bg-green-500';
        borderColor = 'border-green-500';
      } else {
        bgColor = 'bg-gray-600';
        borderColor = 'border-gray-600';
      }
      textColor = 'text-white';
    } else if (status === 'in_progress' || isActive) {
      if (info.track === 'trigger') {
        bgColor = 'bg-blue-400';
        borderColor = 'border-blue-400';
      } else if (info.track === 'evidence') {
        bgColor = 'bg-green-400';
        borderColor = 'border-green-400';
      } else {
        bgColor = 'bg-gray-500';
        borderColor = 'border-gray-500';
      }
      textColor = 'text-white';
    } else if (!canProceed) {
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-300';
      borderColor = 'border-gray-200 border-dashed';
    }

    return `${bgColor} ${textColor} ${borderColor}`;
  };

  const getConnectorStyle = (stepId: PhaseStepId) => {
    const status = steps[stepId]?.status;
    const info = STEP_INFO[stepId];

    if (status === 'completed') {
      if (info.track === 'trigger') return 'bg-blue-500';
      if (info.track === 'evidence') return 'bg-green-500';
      return 'bg-gray-500';
    }
    return 'bg-gray-200';
  };

  const handleStepClick = (stepId: PhaseStepId) => {
    if (projectId && canProceedToStep(stepId)) {
      router.push(`/project/${projectId}/step/${stepId}`);
    }
  };

  const renderStepNode = (stepId: PhaseStepId, showConnector: boolean = true, isLast: boolean = false) => {
    const info = STEP_INFO[stepId];
    const canProceed = canProceedToStep(stepId);

    return (
      <div key={stepId} className="flex items-center">
        <button
          onClick={() => handleStepClick(stepId)}
          disabled={!canProceed}
          className={`
            flex flex-col items-center justify-center
            w-10 h-10 rounded-full border-2
            text-xs font-medium
            transition-all duration-200
            ${canProceed ? 'hover:scale-110 cursor-pointer' : 'cursor-not-allowed'}
            ${getStepStyle(stepId)}
          `}
          title={`${stepId}: ${info.label}`}
        >
          <span className="text-[10px] leading-none">{info.shortLabel}</span>
        </button>
        {showConnector && !isLast && (
          <div className={`w-6 h-1 ${getConnectorStyle(stepId)}`} />
        )}
      </div>
    );
  };

  const renderTrack = (stepIds: PhaseStepId[], label: string, color: string) => {
    return (
      <div className="flex items-center">
        <span className={`text-xs font-medium w-16 ${color}`}>{label}</span>
        <div className="flex items-center">
          {stepIds.map((stepId, idx) => renderStepNode(stepId, true, idx === stepIds.length - 1))}
        </div>
      </div>
    );
  };

  // P2AとP2Bの両方が完了しているかチェック
  const p2aCompleted = P2A_STEPS.every((s) => steps[s]?.status === 'completed');
  const p2bCompleted = P2B_STEPS.every((s) => steps[s]?.status === 'completed');
  const branchMergeConnectorStyle = p2aCompleted && p2bCompleted ? 'bg-gray-500' : 'bg-gray-200';

  return (
    <div className="w-full py-4 px-2 bg-gray-50 rounded-lg">
      {/* P1 共通 */}
      <div className="flex items-center mb-4">
        <span className="text-xs font-medium w-16 text-gray-600">P1 共通</span>
        <div className="flex items-center">
          {P1_STEPS.map((stepId, idx) => renderStepNode(stepId, true, idx === P1_STEPS.length - 1))}
        </div>
        {/* 分岐ポイント */}
        <div className="flex flex-col items-center mx-2">
          <div className={`w-1 h-4 ${steps['1-2']?.status === 'completed' ? 'bg-gray-500' : 'bg-gray-200'}`} />
          <div className={`w-1 h-4 ${steps['1-2']?.status === 'completed' ? 'bg-gray-500' : 'bg-gray-200'}`} />
        </div>
      </div>

      {/* P2A Trigger */}
      <div className="ml-4 mb-2 pl-12 border-l-2 border-gray-300">
        {renderTrack(P2A_STEPS, '🔵 Trigger', 'text-blue-600')}
      </div>

      {/* P2B Evidence */}
      <div className="ml-4 mb-4 pl-12 border-l-2 border-gray-300">
        {renderTrack(P2B_STEPS, '🟢 Evidence', 'text-green-600')}
      </div>

      {/* 合流ポイント */}
      <div className="flex items-center ml-4 pl-12 mb-2">
        <div className="flex flex-col items-center mr-2">
          <div className={`w-1 h-2 ${branchMergeConnectorStyle}`} />
        </div>
      </div>

      {/* P3 統合 */}
      <div className="flex items-center">
        <span className="text-xs font-medium w-16 text-gray-600">P3 統合</span>
        <div className="flex items-center ml-12">
          {P3_STEPS.map((stepId, idx) => renderStepNode(stepId, true, idx === P3_STEPS.length - 1))}
        </div>
      </div>

      {/* 凡例 */}
      <div className="mt-4 pt-3 border-t border-gray-200 flex gap-4 text-xs text-gray-500">
        <span>🔵 Trigger = 介入発話</span>
        <span>🟢 Evidence = 参加者の反応</span>
      </div>
    </div>
  );
}
