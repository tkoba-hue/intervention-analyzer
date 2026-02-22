'use client';

import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

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
  const step = steps[10];

  // scope_final が goal_related の行のみ
  const targetRecords = data.filter(
    (r) => r.evidence_flag_strict && r.scope_final === 'goal_related'
  );
  const assignedCount = targetRecords.filter((r) => r.goal_domain_final).length;

  const handleAutoProcess = async () => {
    updateStepStatus(10, 'in_progress');

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
      updateStepProgress(10, targetRecords.length, targetRecords.length);
      updateStepStatus(10, 'completed');
    } catch (error) {
      console.error('Classify goal domain error:', error);
      updateStepStatus(10, 'pending');
    }
  };

  const handleDomainChange = (id: string, domain: string) => {
    updateRecord(id, { goal_domain_final: domain });
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 10: goal_domain 付与</h2>
      <p className="text-gray-600 mb-6">
        scope が goal_related のエビデンスに目標ドメインを付与します。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            目標関連のエビデンスを「どの分野の行動変容か」で分類します。
            最終レポートでドメイン別の分析ができるようになります。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">ドメインの選び方</h4>
          <p>
            発話の内容から最も関連性の高いドメインを1つ選択してください。
            複数にまたがる場合は、主要なものを選びます。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">次のステップ</h4>
          <p>全ての分類が完了したら、Step 11でレポートを出力できます。</p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">対象件数:</span>
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

      <button
        onClick={handleAutoProcess}
        className="mb-6 px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
      >
        自動判定実行
      </button>

      <div className="space-y-4">
        {targetRecords.map((record) => (
          <div key={record.id} className="border rounded-lg p-4 bg-white">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs text-gray-400">#{record.id}</span>
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
          対象がありません。Step 7 で scope を goal_related に設定した行が対象です。
        </p>
      )}
    </div>
  );
}
