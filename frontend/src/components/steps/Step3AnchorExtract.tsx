'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const STEP_ID = '6' as const;

export default function Step3AnchorExtract() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[STEP_ID];

  const participantCount = data.filter((r) => r.speaker === 'participant' && !r.exclude_flag).length;
  const anchorCount = data.filter((r) => r.evidence_anchor === 1).length;

  const handleProcess = async () => {
    updateStepStatus(STEP_ID, 'in_progress');

    try {
      // バックエンドAPIでアンカー候補抽出
      const records = data.map((r) => ({
        id: r.id,
        datetime: r.datetime,
        speaker: r.speaker,
        text_raw: r.text_raw,
        text_norm: r.text_norm,
        exclude_flag: r.exclude_flag,
      }));

      const response = await api.extractAnchors(records);

      // 結果をストアに反映
      const updates = response.records.map((r) => ({
        id: r.id,
        evidence_anchor: r.evidence_anchor,
        evidence_anchor_confidence: r.evidence_anchor_confidence,
      }));
      bulkUpdateRecords(updates);

      updateStepProgress(STEP_ID, response.total_participant_count, response.total_participant_count);
      updateStepStatus(STEP_ID, 'completed');
    } catch (error) {
      console.error('Extract anchors error:', error);
      updateStepStatus(STEP_ID, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-green-600">
        Step 6: Evidence 候補抽出
      </h2>
      <p className="text-gray-600 mb-6">
        参加者の発話から、エビデンス候補をパターンマッチで抽出します。
      </p>

      <StepExplanation title="機械がやること" defaultExpanded={true}>
        <div className="space-y-2 text-sm">
          <p><strong>1. パターン検索:</strong> 「やってみる」「始めた」「できた」等の語彙パターンを検出</p>
          <p><strong>2. 確信度計算:</strong> パターン一致数に基づいて確信度スコア（0〜1）を算出</p>
          <p><strong>3. 候補フラグ付与:</strong> evidence_anchor = 1 を付与</p>
        </div>
        <div className="mt-3 p-3 bg-green-50 rounded text-sm">
          <strong>確認ポイント:</strong> 次のステップ（Step 7: 確定）で人間が候補を確認・確定します。
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">参加者発話数:</span>
            <span className="ml-2 font-medium">{participantCount}</span>
          </div>
          <div>
            <span className="text-gray-500">候補数:</span>
            <span className="ml-2 font-medium text-green-600">{anchorCount}</span>
          </div>
          <div>
            <span className="text-gray-500">抽出率:</span>
            <span className="ml-2 font-medium">
              {participantCount > 0 ? ((anchorCount / participantCount) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      </div>

      <button
        onClick={handleProcess}
        disabled={step?.status === 'in_progress' || participantCount === 0}
        className={`
          px-6 py-2 rounded-lg font-medium
          ${step?.status === 'in_progress' || participantCount === 0
            ? 'bg-gray-300 cursor-not-allowed'
            : 'bg-green-500 hover:bg-green-600 text-white'
          }
        `}
      >
        {step?.status === 'completed' ? '再処理' : '候補抽出実行'}
      </button>
    </div>
  );
}
