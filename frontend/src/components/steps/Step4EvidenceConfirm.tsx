'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import StepExplanation from '@/components/common/StepExplanation';

// マッチしたパターンをハイライト表示
function HighlightedText({ text, patterns }: { text: string; patterns?: string[] }) {
  if (!patterns || patterns.length === 0) {
    return <>{text}</>;
  }

  // パターンをエスケープして正規表現を作成
  const escapedPatterns = patterns.map((p) =>
    p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const regex = new RegExp(`(${escapedPatterns.join('|')})`, 'gi');

  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const isMatch = patterns.some(
          (p) => p.toLowerCase() === part.toLowerCase()
        );
        return isMatch ? (
          <span
            key={index}
            className="bg-yellow-200 font-bold px-0.5 rounded"
          >
            {part}
          </span>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </>
  );
}

const STEP_ID = '7' as const;

export default function Step4EvidenceConfirm() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const step = steps[STEP_ID];

  // evidence_anchor=1 の行のみ表示（確信度低い順にソート）
  const candidates = data
    .filter((r) => r.evidence_anchor === 1 && r.speaker === 'participant')
    .sort((a, b) => a.evidence_anchor_confidence - b.evidence_anchor_confidence);

  const pendingCount = candidates.filter((r) => r.evidence_confirm === undefined).length;
  const confirmedCount = candidates.filter((r) => r.evidence_confirm === 1).length;

  // 一括Yesボタン: 未判定の全てをYesに設定
  const handleBulkApprove = () => {
    const pendingRecords = candidates.filter((r) => r.evidence_confirm === undefined);
    const updates = pendingRecords.map((r) => ({
      id: r.id,
      evidence_confirm: 1,
    }));
    bulkUpdateRecords(updates);
    updateStepProgress(STEP_ID, candidates.length, candidates.length);
    updateStepStatus(STEP_ID, 'completed');
  };

  const handleConfirm = (id: string, confirm: number, reason?: string) => {
    updateRecord(id, {
      evidence_confirm: confirm,
      evidence_reason_if0: reason,
    });

    const newPending = candidates.filter(
      (r) => r.id !== id && r.evidence_confirm === undefined
    ).length;

    if (newPending === 0) {
      updateStepStatus(STEP_ID, 'completed');
    } else {
      updateStepStatus(STEP_ID, 'in_progress');
    }
    updateStepProgress(STEP_ID, candidates.length - newPending, candidates.length);
  };

  const getContext = (recordId: string) => {
    const index = data.findIndex((r) => r.id === recordId);
    if (index === -1) return { before: [], after: [] };

    const before = data.slice(Math.max(0, index - 3), index);
    const after = data.slice(index + 1, index + 4);
    return { before, after };
  };

  const REJECTION_REASONS = [
    { value: 'chitchat', label: '雑談・情報共有のみ' },
    { value: 'quote', label: '引用伝聞（XXらしい）' },
    { value: 'rhetorical', label: '反語否定（XXなんてできない）' },
    { value: 'wrong_meaning', label: '意味違い' },
    { value: 'unclear', label: '判断困難' },
  ];

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-green-600">
        Step 7: Evidence 確定
      </h2>
      <p className="text-gray-600 mb-6">
        候補として抽出された発話を確認し、本当にエビデンス（変化の表明）かどうかを判定します。
        確信度が低いものから順に表示しています。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            パターンマッチで抽出した候補から、実際に「行動変容の表明」に該当するものを人間が確認します。
            機械では判断しにくい文脈や意図を考慮してください。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Yesにする場合</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>参加者自身の意思・行動・変化を表明している</li>
            <li>「やってみます」「できました」「続けています」等の主体的表現</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">Noにする場合</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>雑談・情報共有のみ（天気の話、ニュースの話）</li>
            <li>引用伝聞（「〇〇らしい」「テレビで見た」）</li>
            <li>反語否定（「そんなことできない」→実際はしない意図）</li>
            <li>意味違い（「歩きました」が物理的移動のみ）</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">次のステップ</h4>
          <p>Yesと判定した発話に「エビデンスの種類（意思・計画・実行報告等）」を付与します。</p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">候補数:</span>
            <span className="ml-2 font-medium">{candidates.length}</span>
          </div>
          <div>
            <span className="text-gray-500">未判定:</span>
            <span className="ml-2 font-medium text-amber-600">{pendingCount}</span>
          </div>
          <div>
            <span className="text-gray-500">確定済:</span>
            <span className="ml-2 font-medium text-green-600">{confirmedCount}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-4">
        {pendingCount > 0 && (
          <>
            <button
              onClick={handleBulkApprove}
              className="px-6 py-2 bg-green-500 text-white rounded-lg font-medium hover:bg-green-600"
            >
              全て Yes にする ({pendingCount}件)
            </button>
            <span className="text-sm text-gray-500">
              ※ 確信度の高い候補から仮承認し、違うものだけNoに変更してください
            </span>
          </>
        )}
        <button
          onClick={() => {
            const updates = candidates.map((r) => ({
              id: r.id,
              evidence_confirm: undefined,
              evidence_reason_if0: undefined,
            }));
            bulkUpdateRecords(updates);
            updateStepStatus(STEP_ID, 'pending');
            updateStepProgress(STEP_ID, 0, candidates.length);
          }}
          className="px-6 py-2 bg-gray-500 text-white rounded-lg font-medium hover:bg-gray-600"
        >
          一括クリア
        </button>
      </div>

      <div className="space-y-4">
        {candidates.map((record) => {
          const isExpanded = expandedId === record.id;
          const context = isExpanded ? getContext(record.id) : null;

          return (
            <div
              key={record.id}
              className={`
                border rounded-lg p-4
                ${record.evidence_confirm === 1 ? 'border-green-300 bg-green-50' :
                  record.evidence_confirm === 0 ? 'border-red-300 bg-red-50' :
                  'border-gray-300 bg-white'}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{record.id}</span>
                  <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">
                    確信度: {(record.evidence_anchor_confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <p className="text-gray-800 mb-4">
                <HighlightedText
                  text={record.text_raw}
                  patterns={record.evidence_anchor_patterns}
                />
              </p>

              {record.evidence_anchor_patterns && record.evidence_anchor_patterns.length > 0 && (
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-xs text-gray-500">検出パターン:</span>
                  {record.evidence_anchor_patterns.map((pattern, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded"
                    >
                      {pattern}
                    </span>
                  ))}
                </div>
              )}

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

              {record.evidence_confirm === undefined ? (
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => handleConfirm(record.id, 1)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Yes（エビデンス）
                  </button>
                  {REJECTION_REASONS.map((reason) => (
                    <button
                      key={reason.value}
                      onClick={() => handleConfirm(record.id, 0, reason.value)}
                      className="px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
                    >
                      No: {reason.label}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <span className={`font-medium ${
                    record.evidence_confirm === 1 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {record.evidence_confirm === 1 ? 'Yes' : `No (${record.evidence_reason_if0})`}
                  </span>
                  <button
                    onClick={() => updateRecord(record.id, {
                      evidence_confirm: undefined,
                      evidence_reason_if0: undefined,
                    })}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    判定を取り消す
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {candidates.length === 0 && (
        <p className="text-gray-500">候補がありません。Step 6 を先に実行してください。</p>
      )}
    </div>
  );
}
