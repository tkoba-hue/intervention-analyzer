'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';

export default function Step3AnchorExtract() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[3];

  const participantCount = data.filter((r) => r.speaker === 'participant' && !r.exclude_flag).length;
  const anchorCount = data.filter((r) => r.evidence_anchor === 1).length;

  const handleProcess = async () => {
    updateStepStatus(3, 'in_progress');

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

      updateStepProgress(3, response.total_participant_count, response.total_participant_count);
      updateStepStatus(3, 'completed');
    } catch (error) {
      console.error('Extract anchors error:', error);
      updateStepStatus(3, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 3: anchor 候補抽出</h2>
      <p className="text-gray-600 mb-6">
        参加者の発話から、エビデンス候補をパターンマッチで抽出します。
        「やってみる」「始めた」「できた」等の語彙パターンを検出します。
      </p>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">参加者発話数:</span>
            <span className="ml-2 font-medium">{participantCount}</span>
          </div>
          <div>
            <span className="text-gray-500">候補数:</span>
            <span className="ml-2 font-medium text-blue-600">{anchorCount}</span>
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
        disabled={step.status === 'in_progress' || participantCount === 0}
        className={`
          px-6 py-2 rounded-lg font-medium
          ${step.status === 'in_progress' || participantCount === 0
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
