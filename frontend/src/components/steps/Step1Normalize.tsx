'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';

export default function Step1Normalize() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[1];

  const handleProcess = async () => {
    updateStepStatus(1, 'in_progress');

    try {
      // バックエンドAPIで正規化処理
      const records = data.map((r) => ({
        id: r.id,
        datetime: r.datetime,
        speaker: r.speaker,
        text_raw: r.text_raw,
      }));

      const response = await api.normalize(records);

      // 結果をストアに反映
      const updates = response.records.map((r) => ({
        id: r.id,
        text_norm: r.text_norm,
      }));
      bulkUpdateRecords(updates);

      updateStepProgress(1, response.processed_count, response.processed_count);
      updateStepStatus(1, 'completed');
    } catch (error) {
      console.error('Normalize error:', error);
      updateStepStatus(1, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 1: 正規化</h2>
      <p className="text-gray-600 mb-6">
        HTMLタグの除去、改行の整形、空白の正規化を行います。
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">ステータス:</span>
            <span className={`ml-2 font-medium ${
              step.status === 'completed' ? 'text-green-600' :
              step.status === 'in_progress' ? 'text-blue-600' :
              'text-gray-600'
            }`}>
              {step.status === 'completed' ? '完了' :
               step.status === 'in_progress' ? '処理中...' :
               '未処理'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">処理件数:</span>
            <span className="ml-2 font-medium">
              {step.processedCount} / {step.totalCount}
            </span>
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

      {data.length === 0 && (
        <p className="mt-4 text-amber-600">
          先にデータをアップロードしてください。
        </p>
      )}
    </div>
  );
}
