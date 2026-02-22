'use client';

import { useMemo, useState } from 'react';
import { useProjectStore, ChatRecord } from '@/store/projectStore';

const STEP_ID = '3-3' as const;

// 日付をWeek番号に変換
function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr);
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// 相対Week番号を取得（最初のデータからの週数）
function getRelativeWeek(dateStr: string, firstDate: string): number {
  const date = new Date(dateStr);
  const first = new Date(firstDate);
  const days = Math.floor((date.getTime() - first.getTime()) / (24 * 60 * 60 * 1000));
  return Math.floor(days / 7) + 1;
}

// トリガータイプの優先度
const TRIGGER_PRIORITY: Record<string, number> = {
  '実行提案': 1,
  '根拠提示': 1,
  'リフレーミング': 1,
  '行動継続後押し': 2,
  '承認': 3,
  'ラポール形成': 3,
  '情報収集': 3,
  '運用案内': 3,
};

// 最高優先度のトリガータイプのみを取得
function getHighestPriorityTrigger(triggers: string[]): string | null {
  if (!triggers || triggers.length === 0) return null;

  let bestTrigger: string | null = null;
  let bestPriority = 999;

  for (const t of triggers) {
    const priority = TRIGGER_PRIORITY[t] || 4;
    if (priority < bestPriority) {
      bestPriority = priority;
      bestTrigger = t;
    }
  }

  return bestTrigger;
}

export default function Step11Export() {
  const { data, projectName, steps } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'summary' | 'patterns' | 'timeline' | 'users' | 'log'>('summary');

  // スコープ内のエビデンス
  const inScopeRecords = data.filter((r) => r.evidence_confirm === 1 && r.scope_final === 'in_scope');

  // トリガー→エビデンスのペア
  const linkedPairs = useMemo(() => {
    return inScopeRecords
      .filter((r) => r.linked_prev_id)
      .map((evidence) => {
        const trigger = data.find((r) => r.id === evidence.linked_prev_id);
        return { evidence, trigger };
      })
      .filter((pair) => pair.trigger);
  }, [inScopeRecords, data]);

  // ドメイン別フェーズ遷移
  const domainPhases = useMemo(() => {
    const domains: Record<string, Array<{ id: string; type: string; text: string }>> = {};

    inScopeRecords
      .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
      .forEach((r) => {
        const domain = r.goal_domain_final || 'その他';
        if (!domains[domain]) domains[domain] = [];
        domains[domain].push({
          id: r.id,
          type: r.evidence_type_final || '',
          text: r.text_raw.slice(0, 30) + (r.text_raw.length > 30 ? '...' : ''),
        });
      });

    return domains;
  }, [inScopeRecords]);

  // 介入タイプ別成功率（3種類の集計）
  const triggerStats = useMemo(() => {
    type TriggerStat = { total: number; success: number; evidenceTypes: Record<string, number> };

    // 全体集計
    const overall: Record<string, TriggerStat> = {};
    // ドメイン別集計
    const byDomain: Record<string, Record<string, TriggerStat>> = {};
    // ユーザーID別集計
    const byUser: Record<string, { triggers: Record<string, TriggerStat>; domains: Record<string, number> }> = {};

    // 全other発話のトリガータイプを集計（上位優先）
    data
      .filter((r) => r.speaker === 'other' && !r.exclude_flag && r.trigger_type_final?.length > 0)
      .forEach((r) => {
        const topTrigger = getHighestPriorityTrigger(r.trigger_type_final);
        if (topTrigger) {
          if (!overall[topTrigger]) overall[topTrigger] = { total: 0, success: 0, evidenceTypes: {} };
          overall[topTrigger].total++;
        }
      });

    // スコープ内にリンクされたペアから成功をカウント
    linkedPairs.forEach(({ evidence, trigger }) => {
      if (!trigger?.trigger_type_final) return;

      const topTrigger = getHighestPriorityTrigger(trigger.trigger_type_final);
      if (!topTrigger) return;

      const eType = evidence.evidence_type_final || 'unknown';
      const domain = evidence.goal_domain_final || 'その他';
      const userId = evidence.user_id;

      // 全体集計
      if (overall[topTrigger]) {
        overall[topTrigger].success++;
        overall[topTrigger].evidenceTypes[eType] = (overall[topTrigger].evidenceTypes[eType] || 0) + 1;
      }

      // ドメイン別集計
      if (!byDomain[domain]) byDomain[domain] = {};
      if (!byDomain[domain][topTrigger]) {
        byDomain[domain][topTrigger] = { total: 0, success: 0, evidenceTypes: {} };
      }
      byDomain[domain][topTrigger].success++;
      byDomain[domain][topTrigger].evidenceTypes[eType] =
        (byDomain[domain][topTrigger].evidenceTypes[eType] || 0) + 1;

      // ユーザーID別集計
      if (userId) {
        if (!byUser[userId]) byUser[userId] = { triggers: {}, domains: {} };
        if (!byUser[userId].triggers[topTrigger]) {
          byUser[userId].triggers[topTrigger] = { total: 0, success: 0, evidenceTypes: {} };
        }
        byUser[userId].triggers[topTrigger].success++;
        byUser[userId].domains[domain] = (byUser[userId].domains[domain] || 0) + 1;
      }
    });

    return { overall, byDomain, byUser };
  }, [data, linkedPairs]);

  // 週別エビデンス数＋トリガー数
  const weeklyStats = useMemo(() => {
    const allRecords = data.filter((r) => !r.exclude_flag);
    if (allRecords.length === 0) return { weeks: [], domainWeekly: {}, triggerWeekly: {} };

    const sortedRecords = [...allRecords].sort(
      (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
    );
    const firstDate = sortedRecords[0]?.datetime;

    const weeks: Record<number, { evidenceTotal: number; triggerTotal: number; types: Record<string, number>; triggers: Record<string, number> }> = {};
    const domainWeekly: Record<string, Record<number, number>> = {};
    const triggerWeekly: Record<string, Record<number, number>> = {};

    sortedRecords.forEach((r) => {
      const week = getRelativeWeek(r.datetime, firstDate);
      if (!weeks[week]) weeks[week] = { evidenceTotal: 0, triggerTotal: 0, types: {}, triggers: {} };

      // エビデンス集計（スコープ内のみ）
      if (r.evidence_confirm === 1 && r.scope_final === 'in_scope') {
        weeks[week].evidenceTotal++;
        const type = r.evidence_type_final || 'unknown';
        weeks[week].types[type] = (weeks[week].types[type] || 0) + 1;

        if (r.goal_domain_final) {
          const domain = r.goal_domain_final;
          if (!domainWeekly[domain]) domainWeekly[domain] = {};
          domainWeekly[domain][week] = (domainWeekly[domain][week] || 0) + 1;
        }
      }

      // トリガー集計
      if (r.speaker === 'other' && r.trigger_type_final?.length > 0) {
        weeks[week].triggerTotal++;
        r.trigger_type_final.forEach((t) => {
          weeks[week].triggers[t] = (weeks[week].triggers[t] || 0) + 1;
          if (!triggerWeekly[t]) triggerWeekly[t] = {};
          triggerWeekly[t][week] = (triggerWeekly[t][week] || 0) + 1;
        });
      }
    });

    return {
      weeks: Object.entries(weeks)
        .map(([week, wData]) => ({ week: parseInt(week), ...wData }))
        .sort((a, b) => a.week - b.week),
      domainWeekly,
      triggerWeekly,
    };
  }, [data]);

  // 工程ログ（新フェーズ式）
  const processLog = useMemo(() => {
    const excludedCount = data.filter((r) => r.exclude_flag).length;
    const participantCount = data.filter((r) => r.speaker === 'participant' && !r.exclude_flag).length;
    const anchorCount = data.filter((r) => r.evidence_anchor === 1).length;
    const confirmedCount = data.filter((r) => r.evidence_confirm === 1).length;
    const rejectedCount = data.filter((r) => r.evidence_confirm === 0).length;
    const typedCount = data.filter((r) => r.evidence_confirm === 1 && r.evidence_type_final).length;
    const inScopeCount = inScopeRecords.length;
    const linkedCount = inScopeRecords.filter((r) => r.linked_prev_id).length;
    const domainCount = inScopeRecords.filter((r) => r.goal_domain_final).length;
    const otherCount = data.filter((r) => r.speaker === 'other' && !r.exclude_flag).length;
    const triggerExcludedCount = data.filter((r) => r.speaker === 'other' && r.trigger_excluded).length;
    const triggerAssignedCount = data.filter(
      (r) => r.speaker === 'other' && !r.exclude_flag && !r.trigger_excluded && r.trigger_type_final?.length > 0
    ).length;

    return [
      { step: '1-1', name: '正規化', result: `${data.length}件処理` },
      { step: '1-2', name: '除外マーク', result: `${excludedCount}件除外（${data.length - excludedCount}件が分析対象）` },
      { step: '2A-1', name: 'Trigger候補抽出', result: `${otherCount - triggerExcludedCount}件候補（${triggerExcludedCount}件除外）` },
      { step: '2A-2', name: 'Trigger自動付与', result: `${triggerAssignedCount}件にトリガー付与` },
      { step: '2A-3', name: 'Trigger確定', result: `${triggerAssignedCount}件確定済` },
      { step: '2B-1', name: 'Evidence候補抽出', result: `${anchorCount}件候補（参加者${participantCount}件中）` },
      { step: '2B-2', name: 'Evidence確定', result: `${confirmedCount}件Yes、${rejectedCount}件No` },
      { step: '2B-3', name: 'Evidence分類', result: `type: ${typedCount}件、スコープ内: ${inScopeCount}件` },
      { step: '3-1', name: '文脈リンク', result: `${linkedCount}件リンク済（スコープ内${inScopeCount}件中）` },
      { step: '3-2', name: 'goal_domain', result: `${domainCount}件に付与（スコープ内${inScopeCount}件中）` },
      { step: '3-3', name: '出力', result: 'レポート生成可能' },
    ];
  }, [data, inScopeRecords]);

  // CSV/JSONエクスポート
  const handleExportCSV = () => {
    const headers = [
      'id', 'datetime', 'speaker', 'text_raw',
      'evidence_type_final', 'scope_final', 'goal_domain_final',
      'linked_prev_id', 'linked_trigger_type',
    ];

    const rows = inScopeRecords.map((record) => {
      const linkedRecord = record.linked_prev_id
        ? data.find((r) => r.id === record.linked_prev_id)
        : null;

      return [
        record.id,
        record.datetime,
        record.speaker,
        `"${record.text_raw.replace(/"/g, '""')}"`,
        record.evidence_type_final || '',
        record.scope_final || '',
        record.goal_domain_final || '',
        record.linked_prev_id || '',
        linkedRecord?.trigger_type_final.join(';') || '',
      ].join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'analysis'}_result.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    const exportData = inScopeRecords.map((record) => {
      const linkedRecord = record.linked_prev_id
        ? data.find((r) => r.id === record.linked_prev_id)
        : null;

      return {
        id: record.id,
        datetime: record.datetime,
        speaker: record.speaker,
        text_raw: record.text_raw,
        evidence_type_final: record.evidence_type_final,
        scope_final: record.scope_final,
        goal_domain_final: record.goal_domain_final,
        linked_other: linkedRecord
          ? {
              id: linkedRecord.id,
              text_raw: linkedRecord.text_raw,
              trigger_type_final: linkedRecord.trigger_type_final,
            }
          : null,
      };
    });

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'analysis'}_result.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // 集計
  const typeCounts = inScopeRecords.reduce((acc, r) => {
    const type = r.evidence_type_final || 'unknown';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domainCounts = inScopeRecords.reduce((acc, r) => {
    const domain = r.goal_domain_final || 'unknown';
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domains = Object.keys(domainCounts).filter((d) => d !== 'unknown');

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">3-3: 整形・出力</h2>
      <p className="text-gray-600 mb-6">
        分析結果のレポートとエクスポート
      </p>

      {/* タブ */}
      <div className="flex border-b mb-6 flex-wrap">
        {[
          { id: 'summary', label: 'サマリー' },
          { id: 'patterns', label: '対話パターン' },
          { id: 'timeline', label: '時系列分析' },
          { id: 'users', label: 'ユーザー別' },
          { id: 'log', label: '工程ログ' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 font-medium border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* サマリータブ */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* 集計サマリー */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">集計サマリー</h3>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">evidence_type 別</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(typeCounts).map(([type, count]) => (
                      <tr key={type}>
                        <td className="py-1">{type}</td>
                        <td className="py-1 text-right font-medium">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">goal_domain 別</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {Object.entries(domainCounts).map(([domain, count]) => (
                      <tr key={domain}>
                        <td className="py-1">{domain}</td>
                        <td className="py-1 text-right font-medium">{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t flex items-center gap-4">
              <div>
                <span className="text-gray-500">スコープ内エビデンス:</span>
                <span className="ml-2 font-bold text-lg">{inScopeRecords.length}</span>
              </div>
              <div>
                <span className="text-gray-500">分野:</span>
                <span className="ml-2 font-medium">{domains.join('、') || 'なし'}</span>
              </div>
            </div>
          </div>

          {/* ドメイン別フェーズ遷移 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">分野別の行動変容フェーズ</h3>
            {Object.entries(domainPhases).map(([domain, phases]) => (
              <div key={domain} className="mb-4 last:mb-0">
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  ■ {domain} ({phases.length}件)
                </h4>
                <div className="text-sm text-gray-700 pl-4">
                  {phases.map((phase, idx) => (
                    <span key={phase.id}>
                      {idx > 0 && <span className="text-gray-400"> → </span>}
                      <span className="text-blue-600">{phase.type}</span>
                      <span className="text-gray-500">（「{phase.text}」#{phase.id}）</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {Object.keys(domainPhases).length === 0 && (
              <p className="text-gray-500 text-sm">スコープ内のエビデンスがありません</p>
            )}
          </div>

          {/* 介入タイプ別成功率（全体集計） */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">介入タイプ別 成功率（スコープ内のみ）</h3>
            <p className="text-xs text-gray-500 mb-3">
              ※ P1（実行提案/根拠提示/リフレーミング）&gt; P2（行動継続後押し）&gt; P3 の優先度で最上位のみカウント
            </p>
            <div className="space-y-3">
              {Object.entries(triggerStats.overall)
                .sort((a, b) => (b[1].success / b[1].total || 0) - (a[1].success / a[1].total || 0))
                .map(([type, stats]) => {
                  const rate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
                  const priority = TRIGGER_PRIORITY[type] || 4;
                  return (
                    <div key={type} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-800">{type}</span>
                        <span className="text-xs text-gray-400">(P{priority})</span>
                        <span>: {stats.total}回使用 → {stats.success}回成功</span>
                        <span className="text-green-600 font-medium">({rate}%)</span>
                      </div>
                      {Object.keys(stats.evidenceTypes).length > 0 && (
                        <div className="ml-4 text-gray-600">
                          └ 引き出したタイプ:{' '}
                          {Object.entries(stats.evidenceTypes)
                            .map(([t, c]) => `${t}(${c})`)
                            .join(', ')}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
            {Object.keys(triggerStats.overall).length === 0 && (
              <p className="text-gray-500 text-sm">トリガーが付与されていません</p>
            )}
          </div>

          {/* ドメイン別集計 */}
          <div className="bg-yellow-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">ドメイン別 介入成功率</h3>
            {Object.keys(triggerStats.byDomain).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(triggerStats.byDomain).map(([domain, triggers]) => (
                  <div key={domain}>
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">■ {domain}</h4>
                    <div className="pl-4 space-y-1">
                      {Object.entries(triggers)
                        .sort((a, b) => b[1].success - a[1].success)
                        .map(([type, stats]) => (
                          <div key={type} className="text-sm text-gray-700">
                            {type}: {stats.success}件成功
                            {Object.keys(stats.evidenceTypes).length > 0 && (
                              <span className="text-gray-500">
                                {' '}({Object.entries(stats.evidenceTypes).map(([t, c]) => `${t}:${c}`).join(', ')})
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">スコープ内のリンクデータがありません</p>
            )}
          </div>

          {/* エクスポートボタン */}
          <div className="flex gap-4">
            <button
              onClick={handleExportCSV}
              className="px-6 py-3 rounded-lg font-medium bg-green-500 hover:bg-green-600 text-white"
            >
              CSV でダウンロード
            </button>
            <button
              onClick={handleExportJSON}
              className="px-6 py-3 rounded-lg font-medium bg-blue-500 hover:bg-blue-600 text-white"
            >
              JSON でダウンロード
            </button>
          </div>
        </div>
      )}

      {/* 対話パターンタブ */}
      {activeTab === 'patterns' && (
        <div className="space-y-4">
          <h3 className="font-medium">介入による変化パターン ({linkedPairs.length}件)</h3>
          {linkedPairs.map(({ evidence, trigger }, idx) => {
            const topTrigger = getHighestPriorityTrigger(trigger!.trigger_type_final);
            const triggerPriority = topTrigger ? TRIGGER_PRIORITY[topTrigger] : null;

            return (
              <div key={evidence.id} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 flex-wrap">
                  <span className="font-medium">パターン #{idx + 1}</span>
                  {evidence.goal_domain_final && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                      {evidence.goal_domain_final}
                    </span>
                  )}
                  {topTrigger && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      triggerPriority === 1 ? 'bg-red-100 text-red-700' :
                      triggerPriority === 2 ? 'bg-amber-100 text-amber-700' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      P{triggerPriority} {topTrigger}
                    </span>
                  )}
                  {evidence.evidence_type_final && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      → {evidence.evidence_type_final}
                    </span>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {/* 介入側 */}
                  <div className="bg-blue-50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-medium text-blue-600">【介入側】#{trigger!.id}</span>
                      {trigger!.trigger_type_final.map((t) => {
                        const p = TRIGGER_PRIORITY[t] || 4;
                        return (
                          <span key={t} className={`text-xs px-2 py-0.5 rounded ${
                            p === 1 ? 'bg-red-200 text-red-800' :
                            p === 2 ? 'bg-amber-200 text-amber-800' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            P{p} {t}
                          </span>
                        );
                      })}
                    </div>
                    <p className="text-gray-800">{trigger!.text_raw}</p>
                  </div>

                  {/* 矢印 */}
                  <div className="flex justify-center">
                    <span className="text-gray-400 text-lg">↓</span>
                  </div>

                  {/* 参加者側 */}
                  <div className="bg-green-50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-green-600">【参加者】#{evidence.id}</span>
                      {evidence.evidence_type_final && (
                        <span className="text-xs bg-green-200 px-2 py-0.5 rounded">
                          {evidence.evidence_type_final}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-800">{evidence.text_raw}</p>
                  </div>
                </div>
              </div>
            );
          })}
          {linkedPairs.length === 0 && (
            <p className="text-gray-500">リンクされた対話パターンがありません</p>
          )}
        </div>
      )}

      {/* 時系列分析タブ */}
      {activeTab === 'timeline' && (
        <div className="space-y-6">
          {/* 週別エビデンス・トリガー数 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">週別 エビデンス / トリガー 発生数</h3>
            {weeklyStats.weeks.map(({ week, evidenceTotal, triggerTotal, types, triggers }) => {
              const maxEvidence = Math.max(...weeklyStats.weeks.map((w) => w.evidenceTotal), 1);
              const maxTrigger = Math.max(...weeklyStats.weeks.map((w) => w.triggerTotal), 1);
              const evidenceBarWidth = Math.max((evidenceTotal / maxEvidence) * 100, 5);
              const triggerBarWidth = Math.max((triggerTotal / maxTrigger) * 100, 5);
              return (
                <div key={week} className="mb-4">
                  <div className="text-sm text-gray-600 mb-1">Week {week}</div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-green-600 w-20">エビデンス:</span>
                    <div
                      className="bg-green-500 h-4 rounded"
                      style={{ width: `${evidenceBarWidth}%`, maxWidth: '60%' }}
                    />
                    <span className="text-sm font-medium">{evidenceTotal}件</span>
                    <span className="text-xs text-gray-500">
                      ({Object.entries(types).map(([t, c]) => `${t}:${c}`).join(', ')})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-blue-600 w-20">トリガー:</span>
                    <div
                      className="bg-blue-500 h-4 rounded"
                      style={{ width: `${triggerBarWidth}%`, maxWidth: '60%' }}
                    />
                    <span className="text-sm font-medium">{triggerTotal}件</span>
                    <span className="text-xs text-gray-500">
                      ({Object.entries(triggers).map(([t, c]) => `${t}:${c}`).join(', ')})
                    </span>
                  </div>
                </div>
              );
            })}
            {weeklyStats.weeks.length === 0 && (
              <p className="text-gray-500 text-sm">データがありません</p>
            )}
          </div>

          {/* ドメイン別週次推移 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">ドメイン別 週次推移</h3>
            {Object.keys(weeklyStats.domainWeekly).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th className="text-left pr-4 py-1"></th>
                      {weeklyStats.weeks.map(({ week }) => (
                        <th key={week} className="px-2 py-1 text-center">W{week}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(weeklyStats.domainWeekly).map(([domain, weekData]) => (
                      <tr key={domain}>
                        <td className="pr-4 py-1 font-medium">{domain}:</td>
                        {weeklyStats.weeks.map(({ week }) => (
                          <td key={week} className="px-2 py-1 text-center">
                            {weekData[week] || 0}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">スコープ内のエビデンスがありません</p>
            )}
          </div>

          {/* トリガータイプ別週次推移 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">トリガータイプ別 週次推移</h3>
            {Object.keys(weeklyStats.triggerWeekly).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-sm">
                  <thead>
                    <tr>
                      <th className="text-left pr-4 py-1"></th>
                      {weeklyStats.weeks.map(({ week }) => (
                        <th key={week} className="px-2 py-1 text-center">W{week}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(weeklyStats.triggerWeekly).map(([triggerType, weekData]) => {
                      const p = TRIGGER_PRIORITY[triggerType] || 4;
                      return (
                        <tr key={triggerType}>
                          <td className={`pr-4 py-1 font-medium ${
                            p === 1 ? 'text-red-600' : p === 2 ? 'text-amber-600' : 'text-gray-600'
                          }`}>
                            P{p} {triggerType}:
                          </td>
                          {weeklyStats.weeks.map(({ week }) => (
                            <td key={week} className="px-2 py-1 text-center">
                              {weekData[week] || 0}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">トリガーが付与されていません</p>
            )}
          </div>
        </div>
      )}

      {/* ユーザー別タブ */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          {Object.keys(triggerStats.byUser).length > 0 ? (
            Object.entries(triggerStats.byUser).map(([userId, userData]) => {
              // このユーザーのエビデンスを時系列で取得
              const userEvidence = inScopeRecords
                .filter((r) => r.user_id === userId)
                .sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());

              return (
                <div key={userId} className="bg-white border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-4 text-purple-800">
                    ユーザー: {userId}
                  </h3>

                  {/* ドメイン */}
                  <div className="mb-4">
                    <span className="text-sm font-medium text-gray-600">ドメイン: </span>
                    <span className="text-sm">
                      {Object.entries(userData.domains).map(([d, c]) => `${d}(${c}件)`).join(', ') || 'なし'}
                    </span>
                  </div>

                  {/* 行動変容の流れ */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">行動変容の流れ</h4>
                    <div className="space-y-2 pl-2 border-l-2 border-purple-200">
                      {userEvidence.map((evidence) => {
                        const linkedTrigger = data.find((r) => r.id === evidence.linked_prev_id);
                        const topTrigger = linkedTrigger ? getHighestPriorityTrigger(linkedTrigger.trigger_type_final) : null;

                        return (
                          <div key={evidence.id} className="text-sm">
                            <span className="text-gray-500">
                              {evidence.datetime.slice(0, 10)}
                            </span>
                            <span className={`ml-2 font-medium ${
                              evidence.evidence_type_final === 'action_report' ? 'text-green-600' :
                              evidence.evidence_type_final === 'intention' ? 'text-blue-600' :
                              evidence.evidence_type_final === 'plan' ? 'text-purple-600' :
                              'text-gray-700'
                            }`}>
                              {evidence.evidence_type_final || 'unknown'}
                            </span>
                            <span className="text-gray-600 ml-1">
                              「{evidence.text_raw.slice(0, 25)}...」#{evidence.id}
                            </span>
                            {topTrigger && (
                              <span className="text-xs text-gray-400 ml-1">
                                ← {topTrigger}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 有効だった介入 */}
                  <div className="bg-purple-50 rounded p-3">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">有効だった介入</h4>
                    <div className="text-sm">
                      {Object.entries(userData.triggers).map(([type, stats]) => {
                        const p = TRIGGER_PRIORITY[type] || 4;
                        return (
                          <div key={type} className="text-gray-700">
                            <span className={p === 1 ? 'text-red-600' : p === 2 ? 'text-amber-600' : 'text-gray-600'}>
                              P{p} {type}
                            </span>
                            : {stats.success}回成功
                          </div>
                        );
                      })}
                      {Object.keys(userData.triggers).length === 0 && (
                        <span className="text-gray-500">リンクされた介入なし</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <p className="text-gray-500 mb-2">ユーザーID別のデータがありません</p>
              <p className="text-sm text-gray-400">
                CSVにユーザーID列を含め、マッピング画面で指定してください
              </p>
            </div>
          )}
        </div>
      )}

      {/* 工程ログタブ */}
      {activeTab === 'log' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="font-medium mb-4">分析工程ログ（フェーズ式）</h3>
          <div className="space-y-2 font-mono text-sm">
            {processLog.map((log) => (
              <div key={log.step} className="flex">
                <span className={`w-16 ${
                  log.step.startsWith('2A') ? 'text-blue-600' :
                  log.step.startsWith('2B') ? 'text-green-600' :
                  'text-gray-500'
                }`}>
                  {log.step}
                </span>
                <span className="text-gray-500 w-32">{log.name}</span>
                <span className="text-gray-400 mx-2">→</span>
                <span className="text-gray-800">{log.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
