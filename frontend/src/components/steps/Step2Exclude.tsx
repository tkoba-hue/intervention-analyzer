'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';

export default function Step2Exclude() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[2];

  const excludedCount = data.filter((r) => r.exclude_flag).length;

  const handleProcess = async () => {
    updateStepStatus(2, 'in_progress');

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

      updateStepProgress(2, response.total_count, response.total_count);
      updateStepStatus(2, 'completed');
    } catch (error) {
      console.error('Exclude mark error:', error);
      updateStepStatus(2, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 2: 除外マーク</h2>
      <p className="text-gray-600 mb-6">
        スタンプのみ、絵文字のみ等、分析対象外のメッセージを識別します。
      </p>

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
        disabled={step.status === 'in_progress' || data.length === 0}
        className={`
          px-6 py-2 rounded-lg font-medium
          ${step.status === 'in_progress' || data.length === 0
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
