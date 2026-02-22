'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const EVIDENCE_TYPES = [
  { value: 'awareness', label: '気づき (awareness)', description: '気づき、理解、納得の表明' },
  { value: 'intention', label: '意思 (intention)', description: 'やってみる意思の表明（具体不足）' },
  { value: 'plan', label: '計画 (plan)', description: '次に何をするかが特定できる' },
  { value: 'action_report', label: '実行報告 (action_report)', description: '実行した、できた等の報告' },
  { value: 'continuation', label: '継続 (continuation)', description: '継続の表明' },
  { value: 'barrier', label: '障壁 (barrier)', description: '障壁やできない理由の表明' },
  { value: 'self_efficacy', label: '自己効力感 (self_efficacy)', description: 'できそう、自信等' },
  { value: 'outcome_report', label: '結果報告 (outcome_report)', description: '結果や変化の報告' },
  { value: 'external_event', label: '外部要因 (external_event)', description: '外部要因、環境変化の出来事報告' },
];

export default function Step6EvidenceType() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const step = steps[6];

  // 確信度が低い順にソート（Step 4と同じ方式）
  const strictRecords = data
    .filter((r) => r.evidence_flag_strict)
    .sort((a, b) => (a.evidence_type_confidence || 0) - (b.evidence_type_confidence || 0));
  const assignedCount = strictRecords.filter((r) => r.evidence_type_final).length;
  const autoClassifiedCount = strictRecords.filter((r) => r.evidence_type_auto).length;

  // 自動判定実行
  const handleAutoProcess = async () => {
    updateStepStatus(6, 'in_progress');

    try {
      const response = await api.classifyEvidenceType(data);

      const updates = response.records
        .filter((r) => r.evidence_type_auto)
        .map((r) => ({
          id: r.id,
          evidence_type_auto: r.evidence_type_auto,
          evidence_type_confidence: r.evidence_type_confidence,
          evidence_type_final: r.evidence_type_final,
        }));

      bulkUpdateRecords(updates);

      const newAssigned = response.records.filter((r) => r.evidence_type_final).length;
      updateStepProgress(6, newAssigned, strictRecords.length);

      if (newAssigned === strictRecords.length) {
        updateStepStatus(6, 'completed');
      }
    } catch (error) {
      console.error('Classify evidence type error:', error);
      updateStepStatus(6, 'pending');
    }
  };

  // 文脈取得
  const getContext = (recordId: string) => {
    const index = data.findIndex((r) => r.id === recordId);
    if (index === -1) return { before: [], after: [] };

    const before = data.slice(Math.max(0, index - 3), index);
    const after = data.slice(index + 1, index + 4);
    return { before, after };
  };

  const handleTypeChange = (id: string, type: string) => {
    updateRecord(id, { evidence_type_final: type });

    const newAssigned = strictRecords.filter(
      (r) => r.id === id || r.evidence_type_final
    ).length;

    if (newAssigned === strictRecords.length) {
      updateStepStatus(6, 'completed');
    } else {
      updateStepStatus(6, 'in_progress');
    }
    updateStepProgress(6, newAssigned, strictRecords.length);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 6: evidence_type 付与</h2>
      <p className="text-gray-600 mb-6">
        確定したエビデンス（strict行）に種類を付与します。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            確定したエビデンスを行動変容のフェーズで分類します。
            これにより「どの段階の変化か」を可視化できます。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">分類の優先度</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li><strong>action_report（実行報告）</strong>: 実際に行動した報告</li>
            <li><strong>plan（計画）</strong>: 具体的な行動計画</li>
            <li><strong>intention（意思）</strong>: やる意思はあるが具体性なし</li>
            <li><strong>awareness（気づき）</strong>: 理解・納得の表明</li>
          </ol>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">迷った場合</h4>
          <p>前後の文脈を確認してください。直前の介入側の発話が判断の手がかりになります。</p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">対象件数:</span>
            <span className="ml-2 font-medium">{strictRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">自動判定済:</span>
            <span className="ml-2 font-medium text-blue-600">{autoClassifiedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">確定済:</span>
            <span className="ml-2 font-medium text-green-600">{assignedCount}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleAutoProcess}
          disabled={step.status === 'in_progress' || strictRecords.length === 0}
          className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          デモ用仮判定
        </button>
        <button
          onClick={() => {
            const updates = strictRecords.map((r) => ({
              id: r.id,
              evidence_type_auto: undefined,
              evidence_type_confidence: undefined,
              evidence_type_final: undefined,
            }));
            bulkUpdateRecords(updates);
            updateStepStatus(6, 'pending');
            updateStepProgress(6, 0, strictRecords.length);
          }}
          className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          一括クリア
        </button>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">evidence_type 定義</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {EVIDENCE_TYPES.map((type) => (
            <div key={type.value} className="flex gap-2">
              <span className="font-medium text-blue-600">{type.label}:</span>
              <span className="text-gray-600">{type.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {strictRecords.map((record) => {
          const isExpanded = expandedId === record.id;
          const context = isExpanded ? getContext(record.id) : null;

          return (
            <div
              key={record.id}
              className={`
                border rounded-lg p-4
                ${record.evidence_type_final ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{record.id}</span>
                  {record.evidence_type_confidence !== undefined && (
                    <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                      確信度: {(record.evidence_type_confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {record.evidence_type_auto && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      推定: {record.evidence_type_auto}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <p className="text-gray-800 mb-4">{record.text_raw}</p>

              <button
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                className="text-sm text-blue-500 hover:underline mb-4"
              >
                {isExpanded ? '文脈を閉じる' : '前後の文脈を表示'}
              </button>

              {isExpanded && context && (
                <div className="bg-gray-100 rounded p-3 mb-4 text-sm">
                  {context.before.map((r) => (
                    <div key={r.id} className="mb-1 text-gray-600">
                      <span className={r.speaker === 'other' ? 'text-blue-600' : 'text-green-600'}>
                        [{r.speaker}]
                      </span>{' '}
                      {r.text_raw}
                    </div>
                  ))}
                  <div className="my-2 p-2 bg-yellow-100 rounded font-medium">
                    [participant] {record.text_raw}
                  </div>
                  {context.after.map((r) => (
                    <div key={r.id} className="mt-1 text-gray-600">
                      <span className={r.speaker === 'other' ? 'text-blue-600' : 'text-green-600'}>
                        [{r.speaker}]
                      </span>{' '}
                      {r.text_raw}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-600">タイプ:</label>
                <select
                  value={record.evidence_type_final || ''}
                  onChange={(e) => handleTypeChange(record.id, e.target.value)}
                  className="border rounded px-3 py-2 bg-white"
                >
                  <option value="">-- 選択してください --</option>
                  {EVIDENCE_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {strictRecords.length === 0 && (
        <p className="text-gray-500">対象がありません。Step 5 を先に実行してください。</p>
      )}
    </div>
  );
}
