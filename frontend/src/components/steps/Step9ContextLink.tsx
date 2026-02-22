'use client';

import { useState } from 'react';
import { useProjectStore } from '@/store/projectStore';
import StepExplanation from '@/components/common/StepExplanation';

const TRIGGER_TYPES = [
  { value: '実行提案', priority: 1 },
  { value: '根拠提示', priority: 1 },
  { value: 'リフレーミング', priority: 1 },
  { value: '行動継続後押し', priority: 2 },
  { value: '承認', priority: 3 },
  { value: 'ラポール形成', priority: 3 },
  { value: '情報収集', priority: 3 },
  { value: '運用案内', priority: 3 },
];

export default function Step9ContextLink() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[9];
  const [editingTriggerId, setEditingTriggerId] = useState<string | null>(null);

  const strictRecords = data.filter((r) => r.evidence_flag_strict);
  const linkedCount = strictRecords.filter((r) => r.linked_prev_id).length;

  const handleAutoLink = () => {
    updateStepStatus(9, 'in_progress');

    strictRecords.forEach((record) => {
      const index = data.findIndex((r) => r.id === record.id);
      if (index > 0) {
        for (let i = index - 1; i >= 0; i--) {
          if (data[i].speaker === 'other' && !data[i].exclude_flag) {
            updateRecord(record.id, { linked_prev_id: data[i].id });
            break;
          }
        }
      }
    });

    updateStepProgress(9, strictRecords.length, strictRecords.length);
    updateStepStatus(9, 'completed');
  };

  const getLinkedRecord = (id: string) => {
    return data.find((r) => r.id === id);
  };

  const handleChangeLink = (evidenceId: string, newLinkId: string) => {
    updateRecord(evidenceId, { linked_prev_id: newLinkId || undefined });
  };

  const handleTriggerChange = (otherId: string, triggers: string[]) => {
    updateRecord(otherId, {
      trigger_type_override: triggers,
      trigger_type_final: triggers,
    });
  };

  const getOtherOptions = (currentIndex: number) => {
    const options: { id: string; text: string; datetime: string }[] = [];
    for (let i = currentIndex - 1; i >= Math.max(0, currentIndex - 10); i--) {
      if (data[i].speaker === 'other' && !data[i].exclude_flag) {
        options.push({
          id: data[i].id,
          text: data[i].text_raw.slice(0, 100) + (data[i].text_raw.length > 100 ? '...' : ''),
          datetime: data[i].datetime,
        });
      }
    }
    return options;
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 9: 文脈リンク</h2>
      <p className="text-gray-600 mb-6">
        エビデンスと介入側発話をリンクし、トリガーを確認・修正します。
      </p>

      <StepExplanation title="このステップの目的" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">文脈リンク</h4>
          <p>参加者の変化表明（エビデンス）と、それを引き出した介入側の発話を紐付けます。</p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">トリガー修正</h4>
          <p>
            リンク先にトリガーがない場合や、自動付与されたトリガーを変更したい場合は
            ここで修正できます。付与しない（空）も許容されます。
          </p>
        </div>
      </StepExplanation>

      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-500">対象件数:</span>
            <span className="ml-2 font-medium">{strictRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">リンク済:</span>
            <span className="ml-2 font-medium text-green-600">{linkedCount}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={handleAutoLink}
          className="px-6 py-2 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
        >
          自動リンク実行
        </button>
        <button
          onClick={() => {
            if (!confirm('リンクをクリアしますか？')) return;
            const updates = strictRecords.map((r) => ({
              id: r.id,
              linked_prev_id: undefined,
            }));
            bulkUpdateRecords(updates);
            updateStepStatus(9, 'pending');
            updateStepProgress(9, 0, strictRecords.length);
          }}
          className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          一括クリア
        </button>
      </div>

      <div className="space-y-6">
        {strictRecords.map((record) => {
          const linkedRecord = record.linked_prev_id
            ? getLinkedRecord(record.linked_prev_id)
            : null;
          const currentIndex = data.findIndex((r) => r.id === record.id);
          const otherOptions = getOtherOptions(currentIndex);
          const isEditingTrigger = editingTriggerId === linkedRecord?.id;
          const hasTrigger = linkedRecord && linkedRecord.trigger_type_final.length > 0;

          return (
            <div key={record.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-400">エビデンス #{record.id}</span>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              {/* 参加者の発話 */}
              <div className="bg-green-50 p-3 rounded mb-4">
                <span className="text-xs text-green-600 font-medium">参加者の発話:</span>
                <p className="text-gray-800 mt-1">{record.text_raw}</p>
              </div>

              {/* リンク先選択 */}
              <div className="mb-4">
                <label className="text-sm font-medium text-gray-600">リンク先のother発話:</label>
                <select
                  value={record.linked_prev_id || ''}
                  onChange={(e) => handleChangeLink(record.id, e.target.value)}
                  className="w-full mt-1 border rounded px-3 py-2 bg-white"
                >
                  <option value="">-- リンクなし --</option>
                  {otherOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      #{opt.id}: {opt.text}
                    </option>
                  ))}
                </select>
              </div>

              {/* リンク先の介入側発話 */}
              {linkedRecord && (
                <div className={`p-3 rounded ${hasTrigger ? 'bg-blue-50' : 'bg-amber-50 border border-amber-200'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-xs font-medium ${hasTrigger ? 'text-blue-600' : 'text-amber-600'}`}>
                      リンク先（介入側）:
                      {!hasTrigger && <span className="ml-2">⚠️ トリガー未設定</span>}
                    </span>
                    <button
                      onClick={() => setEditingTriggerId(isEditingTrigger ? null : linkedRecord.id)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {isEditingTrigger ? '閉じる' : 'トリガー修正'}
                    </button>
                  </div>
                  <p className="text-gray-800 mb-2">{linkedRecord.text_raw}</p>

                  {/* トリガー表示 or 編集 */}
                  {isEditingTrigger ? (
                    <div className="mt-3 pt-3 border-t">
                      <p className="text-xs text-gray-500 mb-2">トリガーを選択（複数可、空も可）:</p>
                      <div className="flex flex-wrap gap-2">
                        {TRIGGER_TYPES.map((type) => {
                          const isSelected = linkedRecord.trigger_type_final.includes(type.value);
                          return (
                            <button
                              key={type.value}
                              onClick={() => {
                                const newTriggers = isSelected
                                  ? linkedRecord.trigger_type_final.filter((t) => t !== type.value)
                                  : [...linkedRecord.trigger_type_final, type.value];
                                handleTriggerChange(linkedRecord.id, newTriggers);
                              }}
                              className={`px-3 py-1 rounded text-xs ${
                                isSelected
                                  ? type.priority === 1 ? 'bg-red-500 text-white' :
                                    type.priority === 2 ? 'bg-amber-500 text-white' :
                                    'bg-gray-500 text-white'
                                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                              }`}
                            >
                              {type.value}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    linkedRecord.trigger_type_final.length > 0 && (
                      <div className="flex gap-1 flex-wrap">
                        {linkedRecord.trigger_type_final.map((t) => {
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
                    )
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
