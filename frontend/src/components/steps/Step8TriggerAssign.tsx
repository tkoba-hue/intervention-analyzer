'use client';

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
        結果はStep 9で文脈リンクと合わせて確認できます。
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

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <span className="text-gray-500">other発話数:</span>
            <span className="ml-2 font-medium">{otherRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">付与済:</span>
            <span className="ml-2 font-medium text-green-600">{assignedCount}</span>
          </div>
        </div>

        {assignedCount > 0 && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-gray-600 mb-2">優先度別集計</h4>
            <div className="flex gap-4 text-sm">
              <span className="text-red-600 font-medium">P1: {p1Count}件</span>
              <span className="text-amber-600 font-medium">P2: {p2Count}件</span>
              <span className="text-gray-600 font-medium">P3: {p3Count}件</span>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">トリガー定義</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {TRIGGER_TYPES.map((type) => (
            <div key={type.value} className="flex gap-2">
              <span className={`font-medium ${
                type.priority === 1 ? 'text-red-600' :
                type.priority === 2 ? 'text-amber-600' :
                'text-gray-600'
              }`}>
                P{type.priority} {type.value}:
              </span>
              <span className="text-gray-600">{type.description}</span>
              {assignedCount > 0 && triggerStats[type.value] > 0 && (
                <span className="text-gray-400">({triggerStats[type.value]}件)</span>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4">
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
    </div>
  );
}
