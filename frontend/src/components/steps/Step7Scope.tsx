'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const SCOPE_OPTIONS = [
  { value: 'goal_related', label: '目標関連 (goal_related)', description: '目標行動や生活改善に関する発話' },
  { value: 'rapport_related', label: 'ラポール関連 (rapport_related)', description: '関係づくり、雑談' },
  { value: 'ops_related', label: '運用関連 (ops_related)', description: '操作、仕様、トラブル' },
  { value: 'service_related', label: 'サービス関連 (service_related)', description: '参加やチャット継続' },
];

export default function Step7Scope() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[7];

  const strictRecords = data.filter((r) => r.evidence_flag_strict);
  const assignedCount = strictRecords.filter((r) => r.scope_final).length;
  const overriddenCount = strictRecords.filter((r) => r.scope_override).length;

  const handleAutoProcess = async () => {
    updateStepStatus(7, 'in_progress');

    try {
      const response = await api.classifyScope(data);

      const updates = response.records
        .filter((r) => r.scope_auto)
        .map((r) => ({
          id: r.id,
          scope_auto: r.scope_auto,
          scope_final: r.scope_final,
        }));

      bulkUpdateRecords(updates);
      updateStepProgress(7, strictRecords.length, strictRecords.length);
      updateStepStatus(7, 'completed');
    } catch (error) {
      console.error('Classify scope error:', error);
      updateStepStatus(7, 'pending');
    }
  };

  const handleOverride = (id: string, scope: string) => {
    updateRecord(id, {
      scope_override: scope,
      scope_final: scope,
    });
  };

  const handleRevert = (id: string) => {
    const record = data.find((r) => r.id === id);
    if (record) {
      updateRecord(id, {
        scope_override: undefined,
        scope_final: record.scope_auto,
      });
    }
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 7: scope 付与</h2>
      <p className="text-gray-600 mb-6">
        エビデンスのスコープを付与します。自動判定後、必要に応じてオーバーライドできます。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            エビデンスが「何に関する変化か」を分類します。
            目標行動（運動・栄養等）に関連するものが分析の主対象です。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">スコープの定義</h4>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>goal_related</strong>: 目標行動や生活改善に関する発話 → Step 10で詳細分類</li>
            <li><strong>rapport_related</strong>: 関係づくり、雑談</li>
            <li><strong>ops_related</strong>: 操作、仕様、トラブル</li>
            <li><strong>service_related</strong>: 参加やチャット継続</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">次のステップ</h4>
          <p>goal_relatedに分類されたものに、目標ドメイン（運動・栄養等）を付与します。</p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-gray-500">対象件数:</span>
            <span className="ml-2 font-medium">{strictRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">付与済:</span>
            <span className="ml-2 font-medium text-green-600">{assignedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">オーバーライド:</span>
            <span className="ml-2 font-medium text-amber-600">{overriddenCount}</span>
          </div>
        </div>
      </div>

      <button
        onClick={handleAutoProcess}
        disabled={step.status === 'in_progress' || strictRecords.length === 0}
        className="mb-6 px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
      >
        自動判定実行
      </button>

      <div className="space-y-4">
        {strictRecords.map((record) => {
          const isOverridden = !!record.scope_override;

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
                  {isOverridden && (
                    <span className="text-xs bg-amber-200 px-2 py-0.5 rounded">オーバーライド</span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <p className="text-gray-800 mb-4">{record.text_raw}</p>

              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-600">スコープ:</label>
                <select
                  value={record.scope_final || ''}
                  onChange={(e) => handleOverride(record.id, e.target.value)}
                  className={`border rounded px-3 py-2 ${isOverridden ? 'bg-amber-100' : 'bg-white'}`}
                >
                  <option value="">-- 選択 --</option>
                  {SCOPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                {isOverridden && (
                  <button
                    onClick={() => handleRevert(record.id)}
                    className="text-sm text-blue-500 hover:underline"
                  >
                    元に戻す
                  </button>
                )}
                {record.scope_auto && (
                  <span className="text-xs text-gray-400">
                    自動判定: {record.scope_auto}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
