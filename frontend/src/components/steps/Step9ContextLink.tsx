'use client';

import { useProjectStore } from '@/store/projectStore';
import StepExplanation from '@/components/common/StepExplanation';

export default function Step9ContextLink() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const step = steps[9];

  const strictRecords = data.filter((r) => r.evidence_flag_strict);
  const linkedCount = strictRecords.filter((r) => r.linked_prev_id).length;

  const handleAutoLink = () => {
    updateStepStatus(9, 'in_progress');

    // strict行の直前のother発話を自動でリンク
    strictRecords.forEach((record) => {
      const index = data.findIndex((r) => r.id === record.id);
      if (index > 0) {
        // 直前のother発話を探す
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

  // 選択可能なother発話（直近10件）
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
        確定したエビデンス（strict行）と、それに対応する介入側（other）の発話をリンクします。
      </p>

      <StepExplanation title="このステップの目的と判断基準" defaultExpanded={false}>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">目的</h4>
          <p>
            参加者の変化表明（エビデンス）と、それを引き出した介入側の発話を紐付けます。
            これにより「どの介入がどの反応を引き出したか」を分析できます。
          </p>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">リンクの判断基準</h4>
          <ul className="list-disc list-inside space-y-1">
            <li>基本は直前のother発話を選択（自動リンクの初期値）</li>
            <li>参加者の発話が介入に対する直接的な反応かを確認</li>
            <li>時間的に離れている場合や、話題が異なる場合は変更</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium text-gray-800 mb-2">リンクしない場合</h4>
          <p>
            介入とは無関係に参加者が自発的に報告した場合は「リンクなし」を選択できます。
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

          return (
            <div key={record.id} className="border rounded-lg p-4 bg-white">
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs text-gray-400">エビデンス #{record.id}</span>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <div className="bg-green-50 p-3 rounded mb-4">
                <span className="text-xs text-green-600 font-medium">参加者の発話:</span>
                <p className="text-gray-800 mt-1">{record.text_raw}</p>
              </div>

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

              {linkedRecord && (
                <div className="bg-blue-50 p-3 rounded">
                  <span className="text-xs text-blue-600 font-medium">リンク先（介入側）:</span>
                  <p className="text-gray-800 mt-1">{linkedRecord.text_raw}</p>
                  {linkedRecord.trigger_type_final.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {linkedRecord.trigger_type_final.map((t) => (
                        <span key={t} className="text-xs bg-blue-200 px-2 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
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
