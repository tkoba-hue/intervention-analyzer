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
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[8];

  const otherRecords = data.filter((r) => r.speaker === 'other' && !r.exclude_flag);
  const assignedCount = otherRecords.filter((r) => r.trigger_type_final.length > 0).length;

  // 確信度が低い順にソート（要確認のものを上に）
  const sortedRecords = useMemo(() => {
    return [...otherRecords].sort((a, b) => {
      const confA = a.trigger_type_confidence ?? 1;
      const confB = b.trigger_type_confidence ?? 1;
      return confA - confB;
    });
  }, [otherRecords]);

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

  const handleTriggerChange = (id: string, triggers: string[]) => {
    // 優先度ルール適用: P1があればP3は除外
    const hasP1 = triggers.some((t) => {
      const type = TRIGGER_TYPES.find((tt) => tt.value === t);
      return type && type.priority === 1;
    });

    const filteredTriggers = hasP1
      ? triggers.filter((t) => {
          const type = TRIGGER_TYPES.find((tt) => tt.value === t);
          return type && type.priority <= 2;
        })
      : triggers;

    updateRecord(id, {
      trigger_type_override: filteredTriggers,
      trigger_type_final: filteredTriggers,
    });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 8: trigger 付与</h2>
      <p className="text-gray-600 mb-6">
        介入側（other）の発話にトリガー種類を付与します。
        優先度1のトリガーがあれば、優先度3は自動的に除外されます。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            介入側の発話を「どのような介入か」で分類します。
            後のStep 9で参加者の反応（エビデンス）と紐付けます。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">優先度ルール</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong className="text-red-600">P1（積極介入）</strong>: 実行提案、根拠提示、リフレーミング → 行動変容を促す</li>
            <li><strong className="text-amber-600">P2（継続支援）</strong>: 行動継続後押し → 維持を促す</li>
            <li><strong className="text-gray-600">P3（関係維持）</strong>: 承認、ラポール形成、情報収集、運用案内</li>
          </ul>
          <p className="mt-2 text-sm">※ P1がある場合、P3は自動的に除外されます</p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">複数選択の場合</h4>
          <p>1つの発話に複数の要素が含まれる場合は、該当するものを全て選択できます。</p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">other発話数:</span>
            <span className="ml-2 font-medium">{otherRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">付与済:</span>
            <span className="ml-2 font-medium text-green-600">{assignedCount}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">トリガー定義（優先度順）</h3>
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
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleAutoProcess}
        className="mb-6 px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
      >
        自動判定実行
      </button>

      <div className="space-y-4">
        {sortedRecords.slice(0, 50).map((record) => {
          const isOverridden = !!record.trigger_type_override;
          const confidence = record.trigger_type_confidence;
          const confidencePercent = confidence != null ? Math.round(confidence * 100) : null;

          return (
            <div
              key={record.id}
              className={`
                border rounded-lg p-4
                ${isOverridden ? 'border-amber-300 bg-amber-50' : 'border-gray-300 bg-white'}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">#{record.id}</span>
                  {confidencePercent != null && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      confidencePercent >= 70 ? 'bg-green-100 text-green-700' :
                      confidencePercent >= 40 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      確信度 {confidencePercent}%
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <p className="text-gray-800 mb-4">{record.text_raw}</p>

              <div className="flex flex-wrap gap-2">
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
                      className={`
                        px-3 py-1 rounded text-sm
                        ${isSelected
                          ? type.priority === 1 ? 'bg-red-500 text-white' :
                            type.priority === 2 ? 'bg-amber-500 text-white' :
                            'bg-gray-500 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }
                      `}
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

      {sortedRecords.length > 50 && (
        <p className="mt-4 text-gray-500">
          表示は最初の50件です（全{sortedRecords.length}件）
        </p>
      )}
    </div>
  );
}
