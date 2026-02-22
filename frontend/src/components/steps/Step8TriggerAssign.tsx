'use client';

import { useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

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

export default function Step8TriggerAssign() {
  const { steps, data, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[8];

  const otherRecords = data.filter((r) => r.speaker === 'other' && !r.exclude_flag);
  const assignedCount = otherRecords.filter((r) => r.trigger_type_final.length > 0).length;

  // 確信度が高い順にソート（サンプル表示用）
  const topConfidenceRecords = useMemo(() => {
    return [...otherRecords]
      .filter((r) => r.trigger_type_final.length > 0)
      .sort((a, b) => (b.trigger_type_confidence ?? 0) - (a.trigger_type_confidence ?? 0))
      .slice(0, 50);
  }, [otherRecords]);

  // トリガー種類別の集計
  const triggerStats = TRIGGER_TYPES.reduce((acc, type) => {
    acc[type.value] = otherRecords.filter((r) =>
      r.trigger_type_final.includes(type.value)
    ).length;
    return acc;
  }, {} as Record<string, number>);

  const p1Count = otherRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['実行提案', '根拠提示', 'リフレーミング'].includes(t))
  ).length;
  const p2Count = otherRecords.filter((r) =>
    r.trigger_type_final.some((t) => t === '行動継続後押し')
  ).length;
  const p3Count = otherRecords.filter((r) =>
    r.trigger_type_final.some((t) => ['承認', 'ラポール形成', '情報収集', '運用案内'].includes(t))
  ).length;

  const handleAutoProcess = async () => {
    updateStepStatus(8, 'in_progress');

    try {
      const response = await api.classifyTriggers(data);

      const updates = response.records.map((r) => ({
        id: r.id as string,
        trigger_type_auto: r.trigger_type_auto as string[],
        trigger_type_final: r.trigger_type_final as string[],
        trigger_type_confidence: r.trigger_type_confidence as number | undefined,
      }));

      bulkUpdateRecords(updates);
      updateStepProgress(8, otherRecords.length, otherRecords.length);
      updateStepStatus(8, 'completed');
    } catch (error) {
      console.error('Classify triggers error:', error);
      updateStepStatus(8, 'pending');
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 8: trigger 付与</h2>
      <p className="text-gray-600 mb-6">
        介入側（other）の発話にトリガー種類を自動付与します。
        {assignedCount > 0 && (
          <span className="block mt-2 text-blue-600 font-medium">
            仮でトリガーを自動付与しました。Step 9で確認・修正できます。
          </span>
        )}
      </p>

      <StepExplanation title="トリガー定義と優先度ルール" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">優先度ルール</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-red-600">P1（積極介入）</strong>: 実行提案、根拠提示、リフレーミング</li>
            <li><strong className="text-amber-600">P2（継続支援）</strong>: 行動継続後押し</li>
            <li><strong className="text-gray-600">P3（関係維持）</strong>: 承認、ラポール形成、情報収集、運用案内</li>
          </ul>
          <p className="mt-2 text-sm">※ P1がある場合、P3は自動的に除外されます</p>
        </div>
      </StepExplanation>

      {/* 統計表示 */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="text-lg font-medium mb-3">
          {otherRecords.length}件中 <span className="text-green-600">{assignedCount}件</span> にトリガー付与
        </div>

        {assignedCount > 0 && (
          <div className="flex gap-6 text-sm">
            <span className="text-red-600 font-medium">P1（積極介入）: {p1Count}件</span>
            <span className="text-amber-600 font-medium">P2（継続支援）: {p2Count}件</span>
            <span className="text-gray-600 font-medium">P3（関係維持）: {p3Count}件</span>
          </div>
        )}
      </div>

      {/* トリガー定義 */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">トリガー種類別の件数</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {TRIGGER_TYPES.map((type) => (
            <div key={type.value} className="flex gap-2">
              <span className={`font-medium ${
                type.priority === 1 ? 'text-red-600' :
                type.priority === 2 ? 'text-amber-600' :
                'text-gray-600'
              }`}>
                {type.value}:
              </span>
              <span className="text-gray-600">{triggerStats[type.value] || 0}件</span>
            </div>
          ))}
        </div>
      </div>

      {/* ボタン */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleAutoProcess}
          disabled={step.status === 'in_progress' || otherRecords.length === 0}
          className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          自動判定実行
        </button>
        <button
          onClick={() => {
            if (!confirm('トリガー付与をクリアしますか？')) return;
            const updates = otherRecords.map((r) => ({
              id: r.id,
              trigger_type_auto: [] as string[],
              trigger_type_override: undefined,
              trigger_type_final: [] as string[],
              trigger_type_confidence: undefined,
            }));
            bulkUpdateRecords(updates);
            updateStepStatus(8, 'pending');
            updateStepProgress(8, 0, otherRecords.length);
          }}
          className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          一括クリア
        </button>
      </div>

      {/* サンプル表示（確信度が高い50件） */}
      {topConfidenceRecords.length > 0 && (
        <>
          <h3 className="font-medium text-gray-700 mb-3">
            自動判定サンプル（確信度が高い{Math.min(50, topConfidenceRecords.length)}件）
          </h3>
          <div className="space-y-2 mb-4">
            {topConfidenceRecords.map((record) => (
              <div key={record.id} className="border rounded p-3 bg-white text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs text-gray-400">#{record.id}</span>
                  <div className="flex gap-1">
                    {record.trigger_type_final.map((t) => {
                      const type = TRIGGER_TYPES.find((tt) => tt.value === t);
                      return (
                        <span
                          key={t}
                          className={`text-xs px-2 py-0.5 rounded ${
                            type?.priority === 1 ? 'bg-red-100 text-red-700' :
                            type?.priority === 2 ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {t}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <p className="text-gray-700 line-clamp-2">{record.text_raw}</p>
              </div>
            ))}
          </div>

          {/* 注記 */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
            <p className="text-amber-800 font-medium">
              ※ 上記は確信度が高い{Math.min(50, topConfidenceRecords.length)}件のサンプルです（全{assignedCount}件に付与済み）
            </p>
            <p className="text-amber-600 text-sm mt-1">
              トリガーの確認・修正は次のStep 9で行えます
            </p>
          </div>
        </>
      )}
    </div>
  );
}
