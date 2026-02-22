'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const STEP_ID = '2' as const;

export default function Step2Exclude() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[STEP_ID];

  const excludedCount = data.filter((r) => r.exclude_flag).length;

  const handleProcess = async () => {
    updateStepStatus(STEP_ID, 'in_progress');

    try {
      // バックエンドAPIで除外マーク処理
      const records = data.map((r) => ({
        id: r.id,
        datetime: r.datetime,
        speaker: r.speaker,
        text_raw: r.text_raw,
        text_norm: r.text_norm,
      }));

      const response = await api.excludeMark(records);

      // 結果をストアに反映
      const updates = response.records.map((r) => ({
        id: r.id,
        exclude_flag: r.exclude_flag,
        exclude_reason: r.exclude_reason || undefined,
      }));
      bulkUpdateRecords(updates);

      updateStepProgress(STEP_ID, response.total_count, response.total_count);
      updateStepStatus(STEP_ID, 'completed');
    } catch (error) {
      console.error('Exclude mark error:', error);
      updateStepStatus(STEP_ID, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 2: 除外マーク</h2>
      <p className="text-gray-600 mb-6">
        スタンプのみ、絵文字のみ等、分析対象外のメッセージを識別します。
      </p>

      <StepExplanation title="機械がやること" defaultExpanded={true}>
        <div className="space-y-2 text-sm">
          <p><strong>1. パターン検出:</strong> スタンプのみ、絵文字のみのメッセージを検出</p>
          <p><strong>2. 短文判定:</strong> 極端に短いメッセージ（意味のある分析が困難）を検出</p>
          <p><strong>3. 除外理由付与:</strong> なぜ除外されたかの理由を記録</p>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
          <strong>確認ポイント:</strong> 除外されたメッセージは以降の分析から除外されます。
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">全件数:</span>
            <span className="ml-2 font-medium">{data.length}</span>
          </div>
          <div>
            <span className="text-gray-500">除外対象:</span>
            <span className="ml-2 font-medium text-red-600">{excludedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">分析対象:</span>
            <span className="ml-2 font-medium text-green-600">{data.length - excludedCount}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleProcess}
        disabled={step?.status === 'in_progress' || data.length === 0}
        className={`
          px-6 py-2 rounded-lg font-medium
          ${step?.status === 'in_progress' || data.length === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-blue-500 hover:bg-blue-600 text-white'
          }
        `}
      >
        {step?.status === 'completed' ? '再処理' : '処理開始'}
      </button>
    </div>
  );
}
