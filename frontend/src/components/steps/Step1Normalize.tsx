'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const STEP_ID = '1' as const;

export default function Step1Normalize() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[STEP_ID];

  const handleProcess = async () => {
    updateStepStatus(STEP_ID, 'in_progress');

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

      updateStepProgress(STEP_ID, response.processed_count, response.processed_count);
      updateStepStatus(STEP_ID, 'completed');
    } catch (error) {
      console.error('Normalize error:', error);
      updateStepStatus(STEP_ID, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 1: 正規化</h2>
      <p className="text-gray-600 mb-6">
        HTMLタグの除去、改行の整形、空白の正規化を行います。
      </p>

      <StepExplanation title="機械がやること" defaultExpanded={true}>
        <div className="space-y-2 text-sm">
          <p><strong>1. HTMLタグ除去:</strong> &lt;br&gt;、&lt;p&gt;等のタグを削除</p>
          <p><strong>2. 改行整形:</strong> 連続する改行を1つに統合</p>
          <p><strong>3. 空白正規化:</strong> 全角・半角スペースを統一</p>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
          <strong>確認ポイント:</strong> この工程は完全自動です。結果は次のステップで確認できます。
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">ステータス:</span>
            <span className={`ml-2 font-medium ${
              step?.status === 'completed' ? 'text-green-600' :
              step?.status === 'in_progress' ? 'text-blue-600' :
              'text-gray-600'
            }`}>
              {step?.status === 'completed' ? '完了' :
               step?.status === 'in_progress' ? '処理中...' :
               '未処理'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">処理件数:</span>
            <span className="ml-2 font-medium">
              {step?.processedCount || 0} / {step?.totalCount || data.length}
            </span>
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

      {data.length === 0 && (
        <p className="mt-4 text-amber-600">
          先にデータをアップロードしてください。
        </p>
      )}
    </div>
  );
}
