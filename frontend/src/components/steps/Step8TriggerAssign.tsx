'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProjectStore, PhaseStepId } from '@/store/projectStore';
import { api } from '@/lib/api';
import { useParams } from 'next/navigation';
import StepExplanation from '@/components/common/StepExplanation';

type ProcessingState = 'idle' | 'loading' | 'success' | 'error';
interface ProcessingStatus {
  state: ProcessingState;
  message?: string;
}

const TRIGGER_TYPES = [
  { value: '実行提案', priority: 1, description: '具体策を提案する' },
  { value: '根拠提示', priority: 1, description: 'データや基準を提示' },
  { value: 'リフレーミング', priority: 1, description: '意味づけを再構成' },
  { value: '行動継続後押し', priority: 2, description: '継続を促す' },
  { value: '承認', priority: 3, description: '受容的反応' },
  { value: 'ラポール形成', priority: 3, description: '気遣い、見守り' },
  { value: '情報収集', priority: 3, description: '状況確認の質問' },
  { value: '運用案内', priority: 3, description: 'システム案内等' },
];

// フェーズとステップIDのマッピング
const PHASE_TO_STEP: Record<string, PhaseStepId> = {
  'exclude': '2A-1',
  'auto': '2A-2',
  'review': '2A-3',
};

type Phase = 'exclude' | 'auto' | 'review';

export default function Step8TriggerAssign() {
  const params = useParams();
  const currentStepId = params.step as PhaseStepId;

  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();

  // URLのステップIDに基づいてフェーズを決定
  const getPhaseFromStepId = (stepId: PhaseStepId): Phase => {
    if (stepId === '2A-1') return 'exclude';
    if (stepId === '2A-2') return 'auto';
    if (stepId === '2A-3') return 'review';
    return 'exclude';
  };

  const [phase, setPhase] = useState<Phase>(getPhaseFromStepId(currentStepId));
  const [processing, setProcessing] = useState<ProcessingStatus>({ state: 'idle' });

  useEffect(() => {
    setPhase(getPhaseFromStepId(currentStepId));
    setProcessing({ state: 'idle' });
  }, [currentStepId]);

  const currentPhaseStepId = PHASE_TO_STEP[phase];
  const step = steps[currentPhaseStepId];

  const otherRecords = data.filter((r) => r.speaker === 'other' && !r.exclude_flag);
  const excludedRecords = otherRecords.filter((r) => r.trigger_excluded);
  const assignedRecords = otherRecords.filter((r) =>
    !r.trigger_excluded && r.trigger_type_final.length > 0
  );

  const lowConfidenceRecords = useMemo(() => {
    return [...assignedRecords]
      .filter((r) => (r.trigger_type_confidence ?? 1) < 0.7)
      .sort((a, b) => (a.trigger_type_confidence ?? 0) - (b.trigger_type_confidence ?? 0))
      .slice(0, 50);
  }, [assignedRecords]);

  const p1Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['実行提案', '根拠提示', 'リフレーミング'].includes(t))
  ).length;
  const p2Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => t === '行動継続後押し')
  ).length;
  const p3Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['承認', 'ラポール形成', '情報収集', '運用案内'].includes(t))
  ).length;

  // 2A-1: 候補抽出（除外判定）
  const handleExclude = async () => {
    setProcessing({ state: 'loading', message: '候補抽出中...' });
    updateStepStatus('2A-1', 'in_progress');

    try {
      const updates = otherRecords.map((r) => {
        const text = r.text_raw;
        const isExcluded =
          text.length < 5 ||
          /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\s]+$/u.test(text);

        return {
          id: r.id,
          trigger_excluded: isExcluded,
        };
      });

      const excludedCount = updates.filter(u => u.trigger_excluded).length;
      bulkUpdateRecords(updates);
      updateStepProgress('2A-1', otherRecords.length, otherRecords.length);
      updateStepStatus('2A-1', 'completed');
      setProcessing({
        state: 'success',
        message: `完了: ${otherRecords.length}件中 ${excludedCount}件を除外`
      });

      // 少し待ってから次のフェーズへ
      setTimeout(() => {
        setPhase('auto');
        setProcessing({ state: 'idle' });
      }, 1000);
    } catch (error) {
      console.error('Exclude error:', error);
      setProcessing({ state: 'error', message: `エラー: ${error}` });
      updateStepStatus('2A-1', 'pending');
    }
  };

  // 2A-2: 自動付与
  const handleAutoAssign = async () => {
    setProcessing({ state: 'loading', message: 'トリガー分類中... (APIに接続中)' });
    updateStepStatus('2A-2', 'in_progress');

    try {
      // other発話のみをAPIに送信
      const otherData = data.filter(r => r.speaker === 'other' && !r.exclude_flag && !r.trigger_excluded);
      console.log('Sending to API:', otherData.length, 'records');

      const response = await api.classifyTriggers(otherData);
      console.log('API response:', response);

      const updates = response.records.map((r) => ({
        id: r.id as string,
        trigger_type_auto: r.trigger_type_auto as string[],
        trigger_type_final: r.trigger_type_final as string[],
        trigger_type_confidence: r.trigger_type_confidence as number | undefined,
      }));

      const assignedCount = updates.filter(u => u.trigger_type_final.length > 0).length;
      bulkUpdateRecords(updates);
      updateStepProgress('2A-2', otherRecords.length - excludedRecords.length, otherRecords.length - excludedRecords.length);
      updateStepStatus('2A-2', 'completed');
      setProcessing({
        state: 'success',
        message: `完了: ${updates.length}件中 ${assignedCount}件にトリガーを付与`
      });

      setTimeout(() => {
        setPhase('review');
        setProcessing({ state: 'idle' });
      }, 1000);
    } catch (error) {
      console.error('Classify triggers error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setProcessing({ state: 'error', message: `APIエラー: ${errorMessage}` });
      updateStepStatus('2A-2', 'pending');
    }
  };

  // 2A-3: 確定（目視修正）
  const handleTriggerChange = (id: string, triggers: string[]) => {
    updateRecord(id, {
      trigger_type_override: triggers,
      trigger_type_final: triggers,
    });
  };

  const handleComplete = () => {
    updateStepProgress('2A-3', assignedRecords.length, assignedRecords.length);
    updateStepStatus('2A-3', 'completed');
  };

  const handleClear = () => {
    if (!confirm('全てクリアしますか？')) return;
    const updates = otherRecords.map((r) => ({
      id: r.id,
      trigger_excluded: undefined,
      trigger_type_auto: [] as string[],
      trigger_type_override: undefined,
      trigger_type_final: [] as string[],
      trigger_type_confidence: undefined,
    }));
    bulkUpdateRecords(updates);
    updateStepStatus('2A-1', 'pending');
    updateStepStatus('2A-2', 'pending');
    updateStepStatus('2A-3', 'pending');
    updateStepProgress('2A-1', 0, otherRecords.length);
    updateStepProgress('2A-2', 0, otherRecords.length);
    updateStepProgress('2A-3', 0, otherRecords.length);
    setPhase('exclude');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">
        <span className="text-blue-600">🔵</span> P2A: Trigger 処理
      </h2>

      <StepExplanation title="機械がやること" defaultExpanded={false}>
        <div className="space-y-2 text-sm">
          <p><strong>2A-1 候補抽出:</strong> スタンプのみ、短文など明らかにトリガーでないものを除外</p>
          <p><strong>2A-2 自動付与:</strong> キーワードパターンでトリガータイプを自動付与</p>
          <p><strong>2A-3 確定:</strong> 確信度が低いもの（70%未満）を人間が確認・修正</p>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
          <strong>確認ポイント:</strong> 介入者の発話にどのようなトリガー（働きかけ）が含まれているかを判定します。
        </div>
      </StepExplanation>

      {/* フェーズインジケーター */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'exclude', label: '2A-1: 候補抽出', stepId: '2A-1' as PhaseStepId },
          { key: 'auto', label: '2A-2: 自動付与', stepId: '2A-2' as PhaseStepId },
          { key: 'review', label: '2A-3: 確定', stepId: '2A-3' as PhaseStepId },
        ].map((p) => {
          const pStep = steps[p.stepId];
          const isCompleted = pStep?.status === 'completed';
          const isCurrent = phase === p.key;

          return (
            <button
              key={p.key}
              onClick={() => setPhase(p.key as Phase)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 ${
                isCurrent
                  ? 'bg-blue-500 text-white'
                  : isCompleted
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {isCompleted && <span>✓</span>}
              {p.label}
            </button>
          );
        })}
      </div>

      {/* 統計 */}
      <div className="bg-blue-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">other発話:</span>
            <span className="ml-2 font-medium">{otherRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">除外:</span>
            <span className="ml-2 font-medium text-gray-400">{excludedRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">付与済:</span>
            <span className="ml-2 font-medium text-blue-600">{assignedRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">要確認:</span>
            <span className="ml-2 font-medium text-amber-600">{lowConfidenceRecords.length}</span>
          </div>
        </div>
        {assignedRecords.length > 0 && (
          <div className="mt-3 pt-3 border-t border-blue-200 flex gap-4 text-sm">
            <span className="text-red-600 font-medium">P1: {p1Count}件</span>
            <span className="text-amber-600 font-medium">P2: {p2Count}件</span>
            <span className="text-gray-600 font-medium">P3: {p3Count}件</span>
          </div>
        )}
      </div>

      {/* 処理ステータス表示 */}
      {processing.state !== 'idle' && (
        <div className={`mb-4 p-4 rounded-lg ${
          processing.state === 'loading' ? 'bg-blue-50 text-blue-700' :
          processing.state === 'success' ? 'bg-green-50 text-green-700' :
          'bg-red-50 text-red-700'
        }`}>
          {processing.state === 'loading' && (
            <span className="inline-block mr-2 animate-spin">⏳</span>
          )}
          {processing.state === 'success' && (
            <span className="inline-block mr-2">✅</span>
          )}
          {processing.state === 'error' && (
            <span className="inline-block mr-2">❌</span>
          )}
          {processing.message}
        </div>
      )}

      {/* 2A-1: 候補抽出 */}
      {phase === 'exclude' && (
        <div>
          <p className="text-gray-600 mb-4">
            スタンプのみ、短文など明らかにトリガーでないものを除外します。
            <span className="block mt-1 text-sm text-gray-500">
              対象: other発話 {otherRecords.length}件
            </span>
          </p>
          <button
            onClick={handleExclude}
            disabled={processing.state === 'loading' || otherRecords.length === 0}
            className={`px-6 py-2 rounded-lg font-medium ${
              processing.state === 'loading' || otherRecords.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {processing.state === 'loading' ? '処理中...' : '候補抽出を実行'}
          </button>
          {otherRecords.length === 0 && (
            <p className="mt-2 text-amber-600 text-sm">
              ⚠️ other発話がありません。P1で正規化・除外マークを完了してください。
            </p>
          )}
        </div>
      )}

      {/* 2A-2: 自動付与 */}
      {phase === 'auto' && (
        <div>
          <p className="text-gray-600 mb-4">
            ルールベースでトリガーを自動付与します。
            <span className="block mt-1 text-sm text-gray-500">
              対象: {otherRecords.length - excludedRecords.length}件
              {excludedRecords.length > 0 && ` (${excludedRecords.length}件は除外済み)`}
            </span>
          </p>
          <button
            onClick={handleAutoAssign}
            disabled={processing.state === 'loading' || otherRecords.length - excludedRecords.length === 0}
            className={`px-6 py-2 rounded-lg font-medium ${
              processing.state === 'loading'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            }`}
          >
            {processing.state === 'loading' ? '処理中...' : '自動付与を実行'}
          </button>
          {otherRecords.length - excludedRecords.length === 0 && (
            <p className="mt-2 text-amber-600 text-sm">
              ⚠️ 対象レコードがありません。2A-1を先に完了してください。
            </p>
          )}
        </div>
      )}

      {/* 2A-3: 確定 */}
      {phase === 'review' && (
        <div>
          <p className="text-gray-600 mb-4">
            確信度が低い{lowConfidenceRecords.length}件を確認・修正してください。
            修正が終わったら「完了」を押してください。
          </p>

          {lowConfidenceRecords.length === 0 ? (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-blue-700">確信度が低い項目はありません。</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {lowConfidenceRecords.map((record) => {
                const confidence = record.trigger_type_confidence ?? 0;
                return (
                  <div key={record.id} className="border border-blue-200 rounded-lg p-3 bg-white">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs text-gray-400">#{record.id}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        confidence < 0.4 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        確信度 {Math.round(confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-gray-700 text-sm mb-3 line-clamp-2">{record.text_raw}</p>
                    <div className="flex flex-wrap gap-1">
                      {TRIGGER_TYPES.map((type) => {
                        const isSelected = record.trigger_type_final.includes(type.value);
                        return (
                          <button
                            key={type.value}
                            onClick={() => {
                              const newTriggers = isSelected
                                ? record.trigger_type_final.filter((t) => t !== type.value)
                                : [...record.trigger_type_final, type.value];
                              handleTriggerChange(record.id, newTriggers);
                            }}
                            className={`px-2 py-0.5 rounded text-xs ${
                              isSelected
                                ? type.priority === 1 ? 'bg-red-500 text-white' :
                                  type.priority === 2 ? 'bg-amber-500 text-white' :
                                  'bg-blue-500 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            }`}
                          >
                            {type.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleComplete}
              className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
            >
              完了
            </button>
            <button
              onClick={handleClear}
              className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
            >
              一括クリア
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
