'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';

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

type Phase = 'exclude' | 'auto' | 'review';

export default function Step8TriggerAssign() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[8];
  const [phase, setPhase] = useState<Phase>('exclude');

  const otherRecords = data.filter((r) => r.speaker === 'other' && !r.exclude_flag);

  // 除外対象（トリガーなしでマークされたもの）
  const excludedRecords = otherRecords.filter((r) => r.trigger_excluded);

  // 自動付与済み
  const assignedRecords = otherRecords.filter((r) =>
    !r.trigger_excluded && r.trigger_type_final.length > 0
  );

  // 確信度が低い順にソート（目視修正用）
  const lowConfidenceRecords = useMemo(() => {
    return [...assignedRecords]
      .filter((r) => (r.trigger_type_confidence ?? 1) < 0.7)
      .sort((a, b) => (a.trigger_type_confidence ?? 0) - (b.trigger_type_confidence ?? 0))
      .slice(0, 50);
  }, [assignedRecords]);

  // 統計
  const p1Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['実行提案', '根拠提示', 'リフレーミング'].includes(t))
  ).length;
  const p2Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => t === '行動継続後押し')
  ).length;
  const p3Count = assignedRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['承認', 'ラポール形成', '情報収集', '運用案内'].includes(t))
  ).length;

  // 8-1: 除外判定
  const handleExclude = async () => {
    updateStepStatus(8, 'in_progress');

    // スタンプのみ、短文などを除外
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

    bulkUpdateRecords(updates);
    setPhase('auto');
  };

  // 8-2: 自動付与
  const handleAutoAssign = async () => {
    try {
      const response = await api.classifyTriggers(data);

      const updates = response.records.map((r) => ({
        id: r.id as string,
        trigger_type_auto: r.trigger_type_auto as string[],
        trigger_type_final: r.trigger_type_final as string[],
        trigger_type_confidence: r.trigger_type_confidence as number | undefined,
      }));

      bulkUpdateRecords(updates);
      setPhase('review');
    } catch (error) {
      console.error('Classify triggers error:', error);
    }
  };

  // 8-3: 目視修正
  const handleTriggerChange = (id: string, triggers: string[]) => {
    updateRecord(id, {
      trigger_type_override: triggers,
      trigger_type_final: triggers,
    });
  };

  // 完了
  const handleComplete = () => {
    updateStepProgress(8, otherRecords.length, otherRecords.length);
    updateStepStatus(8, 'completed');
  };

  // 一括クリア
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
    updateStepStatus(8, 'pending');
    updateStepProgress(8, 0, otherRecords.length);
    setPhase('exclude');
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 8: trigger 付与</h2>

      {/* フェーズインジケーター */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'exclude', label: '8-1: 除外判定' },
          { key: 'auto', label: '8-2: 自動付与' },
          { key: 'review', label: '8-3: 目視修正' },
        ].map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPhase(p.key as Phase)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              phase === p.key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* 統計 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
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
            <span className="ml-2 font-medium text-green-600">{assignedRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">要確認:</span>
            <span className="ml-2 font-medium text-amber-600">{lowConfidenceRecords.length}</span>
          </div>
        </div>
        {assignedRecords.length > 0 && (
          <div className="mt-3 pt-3 border-t flex gap-4 text-sm">
            <span className="text-red-600 font-medium">P1: {p1Count}件</span>
            <span className="text-amber-600 font-medium">P2: {p2Count}件</span>
            <span className="text-gray-600 font-medium">P3: {p3Count}件</span>
          </div>
        )}
      </div>

      {/* 8-1: 除外判定 */}
      {phase === 'exclude' && (
        <div>
          <p className="text-gray-600 mb-4">
            スタンプのみ、短文など明らかにトリガーでないものを除外します。
          </p>
          <button
            onClick={handleExclude}
            className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
          >
            除外判定を実行
          </button>
        </div>
      )}

      {/* 8-2: 自動付与 */}
      {phase === 'auto' && (
        <div>
          <p className="text-gray-600 mb-4">
            ルールベースでトリガーを自動付与します。
            {excludedRecords.length > 0 && (
              <span className="block mt-1 text-gray-500">
                ※ {excludedRecords.length}件は除外済み
              </span>
            )}
          </p>
          <button
            onClick={handleAutoAssign}
            className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
          >
            自動付与を実行
          </button>
        </div>
      )}

      {/* 8-3: 目視修正 */}
      {phase === 'review' && (
        <div>
          <p className="text-gray-600 mb-4">
            確信度が低い{lowConfidenceRecords.length}件を確認・修正してください。
            修正が終わったら「完了」を押してください。
          </p>

          {lowConfidenceRecords.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-green-700">確信度が低い項目はありません。</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {lowConfidenceRecords.map((record) => {
                const confidence = record.trigger_type_confidence ?? 0;
                return (
                  <div key={record.id} className="border rounded-lg p-3 bg-white">
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
                                  'bg-gray-500 text-white'
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
              className="px-6 py-2 rounded-lg font-medium bg-green-500 hover:bg-green-600 text-white"
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
