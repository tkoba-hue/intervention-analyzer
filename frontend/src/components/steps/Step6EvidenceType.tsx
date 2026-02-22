'use client';

import { useState, useMemo } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { api } from '@/lib/api';
import StepExplanation from '@/components/common/StepExplanation';

const STEP_ID = '8' as const;

const EVIDENCE_TYPES = [
  { value: 'awareness', label: '気づき (awareness)', description: '気づき、理解、納得の表明' },
  { value: 'intention', label: '意思 (intention)', description: 'やってみる意思の表明（具体不足）' },
  { value: 'plan', label: '計画 (plan)', description: '次に何をするかが特定できる' },
  { value: 'action_report', label: '実行報告 (action_report)', description: '実行した、できた等の報告' },
  { value: 'continuation', label: '継続 (continuation)', description: '継続の表明' },
  { value: 'barrier', label: '障壁 (barrier)', description: '障壁やできない理由の表明' },
  { value: 'self_efficacy', label: '自己効力感 (self_efficacy)', description: 'できそう、自信等' },
  { value: 'situation_report', label: '状況報告 (situation_report)', description: '結果や変化の報告' },
  { value: 'external_event', label: '外部要因 (external_event)', description: '外部要因、環境変化の出来事報告' },
  { value: 'other_excluded', label: 'その他（分析対象外）', description: '判別不能・分析対象外' },
];

// スコープ外として自動設定するタイプ
const OUT_OF_SCOPE_TYPES = ['external_event', 'stop_service', 'other_excluded'];

const SCOPE_OPTIONS = [
  { value: 'in_scope', label: 'スコープ内', description: '目標行動や生活改善に関する変化表明' },
  { value: 'out_of_scope', label: 'スコープ外', description: '雑談・ラポール・運用関連・外部要因' },
];

export default function Step6EvidenceType() {
  const { steps, data, updateRecord, bulkUpdateRecords, updateStepStatus, updateStepProgress } = useProjectStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'pending' | 'all'>('pending');
  const [showDefinitions, setShowDefinitions] = useState(false);
  const step = steps[STEP_ID];

  // evidence_confirm=1 の行（確定したエビデンス）
  const confirmedRecords = useMemo(() => {
    return data
      .filter((r) => r.evidence_confirm === 1)
      .sort((a, b) => (a.evidence_type_confidence || 0) - (b.evidence_type_confidence || 0));
  }, [data]);

  const assignedCount = confirmedRecords.filter((r) => r.evidence_type_final && r.scope_final).length;
  const typeAssignedCount = confirmedRecords.filter((r) => r.evidence_type_final).length;
  const scopeAssignedCount = confirmedRecords.filter((r) => r.scope_final).length;
  const inScopeCount = confirmedRecords.filter((r) => r.scope_final === 'in_scope').length;

  // 表示対象を絞り込み
  const displayRecords = useMemo(() => {
    if (viewMode === 'pending') {
      return confirmedRecords.filter((r) => !r.evidence_type_final || !r.scope_final);
    }
    return confirmedRecords;
  }, [confirmedRecords, viewMode]);

  // 自動判定実行（type + scope 両方）
  const handleAutoProcess = async () => {
    updateStepStatus(STEP_ID, 'in_progress');

    try {
      // Evidence Type 自動分類
      const typeResponse = await api.classifyEvidenceType(data);
      const typeUpdates = typeResponse.records
        .filter((r) => r.evidence_type_auto)
        .map((r) => ({
          id: r.id,
          evidence_type_auto: r.evidence_type_auto,
          evidence_type_confidence: r.evidence_type_confidence,
          evidence_type_final: r.evidence_type_final,
        }));
      bulkUpdateRecords(typeUpdates);

      // Scope 自動分類
      const scopeResponse = await api.classifyScope(data);
      const scopeUpdates = scopeResponse.records
        .filter((r) => r.scope_auto)
        .map((r) => ({
          id: r.id,
          scope_auto: r.scope_auto,
          scope_final: r.scope_final,
        }));
      bulkUpdateRecords(scopeUpdates);

      updateStepProgress(STEP_ID, confirmedRecords.length, confirmedRecords.length);
      updateStepStatus(STEP_ID, 'completed');
    } catch (error) {
      console.error('Classify error:', error);
      updateStepStatus(STEP_ID, 'pending');
    }
  };

  // 文脈取得
  const getContext = (recordId: string) => {
    const index = data.findIndex((r) => r.id === recordId);
    if (index === -1) return { before: [], after: [] };

    const before = data.slice(Math.max(0, index - 3), index);
    const after = data.slice(index + 1, index + 4);
    return { before, after };
  };

  const handleTypeChange = (id: string, type: string) => {
    // タイプに応じてスコープを自動設定
    const autoScope = OUT_OF_SCOPE_TYPES.includes(type) ? 'out_of_scope' : 'in_scope';
    updateRecord(id, {
      evidence_type_final: type,
      scope_final: autoScope,
    });
    checkCompletion();
  };

  const handleScopeChange = (id: string, scope: string) => {
    updateRecord(id, { scope_final: scope });
    checkCompletion();
  };

  const checkCompletion = () => {
    const newAssigned = confirmedRecords.filter(
      (r) => r.evidence_type_final && r.scope_final
    ).length;

    if (newAssigned === confirmedRecords.length) {
      updateStepStatus(STEP_ID, 'completed');
    } else {
      updateStepStatus(STEP_ID, 'in_progress');
    }
    updateStepProgress(STEP_ID, newAssigned, confirmedRecords.length);
  };

  const handleClear = () => {
    if (!confirm('タイプとスコープを全てクリアしますか？')) return;
    const updates = confirmedRecords.map((r) => ({
      id: r.id,
      evidence_type_auto: undefined,
      evidence_type_confidence: undefined,
      evidence_type_final: undefined,
      scope_auto: undefined,
      scope_final: undefined,
    }));
    bulkUpdateRecords(updates);
    updateStepStatus(STEP_ID, 'pending');
    updateStepProgress(STEP_ID, 0, confirmedRecords.length);
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4 text-green-600">
        Step 8: Evidence 分類
      </h2>
      <p className="text-gray-600 mb-6">
        確定したエビデンスに種類（type）とスコープ（内/外）を付与します。
      </p>

      <StepExplanation title="機械がやること" defaultExpanded={false}>
        <div className="space-y-2 text-sm">
          <p><strong>1. evidence_type 判定:</strong> パターンから変化の種類を自動分類</p>
          <p><strong>2. scope 判定:</strong> 目標行動に関連するか（スコープ内）or 雑談等（スコープ外）を判定</p>
          <p><strong>3. 確信度表示:</strong> 確信度が低いものから表示し、人間が優先確認</p>
        </div>
        <div className="mt-3 p-3 bg-green-50 rounded text-sm">
          <strong>確認ポイント:</strong> 「スコープ内」のエビデンスのみが後続分析の対象になります。
        </div>
      </StepExplanation>

      <div className="bg-green-50 rounded-lg p-4 mb-6">
        <div className="grid grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">確定エビデンス:</span>
            <span className="ml-2 font-medium">{confirmedRecords.length}</span>
          </div>
          <div>
            <span className="text-gray-500">type付与済:</span>
            <span className="ml-2 font-medium text-blue-600">{typeAssignedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">scope付与済:</span>
            <span className="ml-2 font-medium text-purple-600">{scopeAssignedCount}</span>
          </div>
          <div>
            <span className="text-gray-500">スコープ内:</span>
            <span className="ml-2 font-medium text-green-600">{inScopeCount}</span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 mb-6 flex-wrap">
        <button
          onClick={handleAutoProcess}
          disabled={step?.status === 'in_progress' || confirmedRecords.length === 0}
          className="px-6 py-2 rounded-lg font-medium bg-green-500 hover:bg-green-600 text-white disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          自動判定実行
        </button>
        <button
          onClick={handleClear}
          className="px-6 py-2 rounded-lg font-medium bg-gray-500 hover:bg-gray-600 text-white"
        >
          一括クリア
        </button>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-sm text-gray-600 font-medium">
            完了: {assignedCount}/{confirmedRecords.length}件
          </span>
          <span className="text-gray-300">|</span>
          <span className="text-sm text-gray-500">表示:</span>
          <button
            onClick={() => setViewMode('pending')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'pending' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            未完了のみ ({displayRecords.length})
          </button>
          <button
            onClick={() => setViewMode('all')}
            className={`px-3 py-1 rounded text-sm ${
              viewMode === 'all' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'
            }`}
          >
            全件
          </button>
        </div>
      </div>

      {/* 定義パネル（折りたたみ可能） */}
      <div className="mb-6">
        <button
          onClick={() => setShowDefinitions(!showDefinitions)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-2"
        >
          <span>{showDefinitions ? '▼' : '▶'}</span>
          <span>タイプ・スコープ定義を{showDefinitions ? '隠す' : '表示'}</span>
        </button>
        {showDefinitions && (
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h3 className="font-medium mb-2 text-blue-800">evidence_type 定義</h3>
              <div className="space-y-1 text-sm">
                {EVIDENCE_TYPES.map((type) => (
                  <div key={type.value} className="flex gap-2">
                    <span className="font-medium text-blue-600 whitespace-nowrap">{type.label}:</span>
                    <span className="text-gray-600">{type.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <h3 className="font-medium mb-2 text-purple-800">scope 定義</h3>
              <div className="space-y-1 text-sm">
                {SCOPE_OPTIONS.map((opt) => (
                  <div key={opt.value} className="flex gap-2">
                    <span className="font-medium text-purple-600 whitespace-nowrap">{opt.label}:</span>
                    <span className="text-gray-600">{opt.description}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {displayRecords.map((record) => {
          const isExpanded = expandedId === record.id;
          const context = isExpanded ? getContext(record.id) : null;
          const isComplete = record.evidence_type_final && record.scope_final;

          return (
            <div
              key={record.id}
              className={`
                border rounded-lg p-4
                ${isComplete ? 'border-green-300 bg-green-50' : 'border-gray-300 bg-white'}
              `}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-gray-400">#{record.id}</span>
                  {record.evidence_type_confidence !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      record.evidence_type_confidence < 0.4 ? 'bg-red-100 text-red-700' :
                      record.evidence_type_confidence < 0.7 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      確信度: {(record.evidence_type_confidence * 100).toFixed(0)}%
                    </span>
                  )}
                  {record.evidence_type_auto && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      推定type: {record.evidence_type_auto}
                    </span>
                  )}
                  {record.scope_auto && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                      推定scope: {record.scope_auto === 'in_scope' ? 'スコープ内' : 'スコープ外'}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-500">{record.datetime}</span>
              </div>

              <p className="text-gray-800 mb-4">{record.text_raw}</p>

              <button
                onClick={() => setExpandedId(isExpanded ? null : record.id)}
                className="text-sm text-blue-500 hover:underline mb-4"
              >
                {isExpanded ? '文脈を閉じる' : '前後の文脈を表示'}
              </button>

              {isExpanded && context && (
                <div className="bg-gray-100 rounded p-3 mb-4 text-sm">
                  {context.before.map((r) => (
                    <div key={r.id} className="mb-1 text-gray-600">
                      <span className={r.speaker === 'other' ? 'text-blue-600' : 'text-green-600'}>
                        [{r.speaker}]
                      </span>{' '}
                      {r.text_raw}
                    </div>
                  ))}
                  <div className="my-2 p-2 bg-yellow-100 rounded font-medium">
                    [participant] {record.text_raw}
                  </div>
                  {context.after.map((r) => (
                    <div key={r.id} className="mt-1 text-gray-600">
                      <span className={r.speaker === 'other' ? 'text-blue-600' : 'text-green-600'}>
                        [{r.speaker}]
                      </span>{' '}
                      {r.text_raw}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-6 flex-wrap">
                {/* Type選択 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">タイプ:</label>
                  <select
                    value={record.evidence_type_final || ''}
                    onChange={(e) => handleTypeChange(record.id, e.target.value)}
                    className="border rounded px-3 py-2 bg-white text-sm"
                  >
                    <option value="">-- 選択 --</option>
                    {EVIDENCE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Scope選択 */}
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-600">スコープ:</label>
                  {SCOPE_OPTIONS.map((opt) => {
                    const isSelected = record.scope_final === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => handleScopeChange(record.id, opt.value)}
                        className={`px-3 py-1 rounded text-sm ${
                          isSelected
                            ? opt.value === 'in_scope'
                              ? 'bg-green-500 text-white'
                              : 'bg-gray-500 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {displayRecords.length === 0 && confirmedRecords.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-700">全件分類完了です。</p>
        </div>
      )}

      {confirmedRecords.length === 0 && (
        <p className="text-gray-500">対象がありません。Step 7（Evidence確定）を先に実行してください。</p>
      )}
    </div>
  );
}
