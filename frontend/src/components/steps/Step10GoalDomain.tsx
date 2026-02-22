'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const STEP_ID = '10' as const;

const GOAL_DOMAINS = [
  { value: '運動', description: '歩行、体操、筋力、運動量、身体活動' },
  { value: '栄養', description: '食事内容、栄養素、食行動、摂取' },
  { value: '睡眠', description: '睡眠、就寝起床、昼寝、睡眠の質' },
  { value: '認知機能', description: '記憶、集中、脳トレ等' },
  { value: '精神', description: '気分、不安、意欲、自己効力感等' },
  { value: '社会参加', description: '外出、会話、交流、活動参加' },
  { value: 'その他', description: '上記に当てはまらない' },
];

export default function Step10GoalDomain() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[STEP_ID];

  // scope_final が in_scope の行のみ
  const targetRecords = data.filter(
    (r) => r.evidence_confirm === 1 && r.scope_final === 'in_scope'
  );
  const assignedCount = targetRecords.filter((r) => r.goal_domain_final).length;

  const handleAutoProcess = async () => {
    updateStepStatus(STEP_ID, 'in_progress');

    try {
      const response = await api.classifyGoalDomain(data);

      const updates = response.records
        .filter((r) => r.goal_domain_auto)
        .map((r) => ({
          id: r.id,
          goal_domain_auto: r.goal_domain_auto,
          goal_domain_final: r.goal_domain_final,
        }));

      bulkUpdateRecords(updates);
      updateStepProgress(STEP_ID, targetRecords.length, targetRecords.length);
      updateStepStatus(STEP_ID, 'completed');
    } catch (error) {
      console.error('Classify goal domain error:', error);
      updateStepStatus(STEP_ID, 'pending');
    }
  };

  const handleDomainChange = (id: string, domain: string) => {
    updateRecord(id, { goal_domain_final: domain });

    const newAssigned = targetRecords.filter(
      (r) => r.id === id || r.goal_domain_final
    ).length;

    if (newAssigned === targetRecords.length) {
      updateStepStatus(STEP_ID, 'completed');
    } else {
      updateStepStatus(STEP_ID, 'in_progress');
    }
    updateStepProgress(STEP_ID, newAssigned, targetRecords.length);
  };

  const handleClear = () => {
    if (!confirm('goal_domainを全てクリアしますか？')) return;
    const updates = targetRecords.map((r) => ({
      id: r.id,
      goal_domain_auto: undefined,
      goal_domain_final: undefined,
    }));
    bulkUpdateRecords(updates);
    updateStepStatus(STEP_ID, 'pending');
    updateStepProgress(STEP_ID, 0, targetRecords.length);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 10: goal_domain 付与</h2>
      <p className="text-gray-600 mb-6">
        スコープ内のエビデンスに目標ドメイン（運動・栄養等）を付与します。
      </p>

      <StepExplanation title="機械がやること" defaultExpanded={false}>
        <div className="space-y-2 text-sm">
          <p><strong>1. キーワード検出:</strong> 「歩く」「体操」→運動、「食べる」「栄養」→栄養、等のパターンマッチ</p>
          <p><strong>2. ドメイン付与:</strong> 検出したキーワードから目標ドメインを自動付与</p>
        </div>
        <div className="mt-3 p-3 bg-blue-50 rounded text-sm">
          <strong>確認ポイント:</strong> 複数にまたがる場合は主要なものを選択してください。
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">対象件数（スコープ内）:</span>
            <span className="ml-2 font-medium">{targetRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">付与済:</span>
            <span className="ml-2 font-medium text-green-600">{assignedCount}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium mb-2">goal_domain 定義</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {GOAL_DOMAINS.map((domain) => (
            <div key={domain.value} className="flex gap-2">
              <span className="font-medium text-blue-600">{domain.value}:</span>
              <span className="text-gray-600">{domain.description}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleAutoProcess}
          disabled={step?.status === 'in_progress' || targetRecords.length === 0}
          className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          自動判定実行
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          一括クリア
        </button>
      </div>

      <div className="space-y-4">
        {targetRecords.map((record) => (
          <div key={record.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">#{record.id}</span>
                {record.evidence_type_final && (
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                    {record.evidence_type_final}
                  </span>
                )}
                {record.goal_domain_auto && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    推定: {record.goal_domain_auto}
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-500">{record.datetime}</span>
            </div>

            <p className="text-gray-800 mb-4">{record.text_raw}</p>

            <div className="flex flex-wrap gap-2">
              {GOAL_DOMAINS.map((domain) => {
                const isSelected = record.goal_domain_final === domain.value;

                return (
                  <button
                    key={domain.value}
                    onClick={() => handleDomainChange(record.id, domain.value)}
                    className={`
                      px-3 py-1 rounded text-sm
                      ${isSelected
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }
                    `}
                  >
                    {domain.value}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {targetRecords.length === 0 && (
        <p className="text-gray-500">
          対象がありません。2B-3（Evidence分類）でスコープ内のエビデンスを確定してください。
        </p>
      )}
    </div>
  );
}
