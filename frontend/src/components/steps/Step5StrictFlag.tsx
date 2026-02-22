'use client';

import { useProjectStore } from '@/store/projectStore';

export default function Step5StrictFlag() {
  const { steps, data, updateRecord, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[5];

  const confirmedCount = data.filter((r) => r.evidence_anchor === 1 && r.evidence_confirm === 1).length;
  const strictCount = data.filter((r) => r.evidence_flag_strict).length;

  const handleProcess = async () => {
    updateStepStatus(5, 'in_progress');

    // evidence_anchor=1 AND evidence_confirm=1 → strict
    data.forEach((record) => {
      if (record.evidence_anchor === 1 && record.evidence_confirm === 1) {
        updateRecord(record.id, { evidence_flag_strict: true });
      }
    });

    updateStepProgress(5, confirmedCount, confirmedCount);
    updateStepStatus(5, 'completed');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 5: strict 判定</h2>
      <p className="text-gray-600 mb-6">
        evidence_anchor=1 かつ evidence_confirm=1 の行を strict（確定エビデンス）とします。
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">確定数（confirm=1）:</span>
            <span className="ml-2 font-medium">{confirmedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">strict フラグ付与済:</span>
            <span className="ml-2 font-medium text-green-600">{strictCount}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleProcess}
        disabled={step.status === 'in_progress' || confirmedCount === 0}
        className={`
          px-6 py-2 rounded-lg font-medium
          ${step.status === 'in_progress' || confirmedCount === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
        `}
      >
        {step.status === 'completed' ? '再処理' : '処理開始'}
      </button>
    </div>
  );
}
