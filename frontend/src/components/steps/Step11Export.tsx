'use client';

import { useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { CSV_BOM, FULL_DATA_COLUMNS, importAnalyzedCsv } from '@/lib/analyzedCsvImport';

const STEP_ID = '11' as const;
function escapeCsvField(value: string): string {
  const escaped = value.replace(/"/g, '""');
  return /[",\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

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

const STAGE_SCORES: Record<string, number> = {
  'awareness': 1, 'status_update': 1,
  'intention': 2,
  'plan': 3,
  'action_report': 4,
  'continuation': 5,
  'outcome_report': 6,
};

const STAGE_NAMES: Record<number, string> = {
  1: '気づき', 2: '意図', 3: '計画', 4: '実行', 5: '継続', 6: '成果',
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

function getStageScore(type?: string): number | undefined {
  if (!type) return undefined;
  return STAGE_SCORES[type];
}

function formatStage(stage?: number): string {
  if (!stage) return '不明';
  return `${STAGE_NAMES[stage] || '不明'}(${stage})`;
}

function formatDelta(delta?: number): string {
  if (delta === undefined) return '−';
  return delta >= 0 ? `+${delta}` : `${delta}`;
}

function classifyTransition(first: number, max: number): string {
  const delta = max - first;
  if (delta === 0) return '変化なし';
  if (first <= 1 && max >= 2) return '関心→意図';
  if (first <= 2 && max === 3) return '意図→計画';
  if (first <= 3 && max === 4) return '計画→実行';
  if (first === 4 && max >= 5) return '実行→維持';
  return `+${delta}段階`;
}

function splitEvidenceTypes(typeStr?: string): string[] {
  if (!typeStr) return [];
  return typeStr.split(',').map((t) => t.trim()).filter(Boolean);
}

export default function Step11Export() {
  const { data, projectName, setData } = useProjectStore();
  const [activeTab, setActiveTab] = useState<'summary' | 'patterns' | 'timeline' | 'users' | 'log'>('summary');
  const [expandedTimelineTexts, setExpandedTimelineTexts] = useState<Set<string>>(new Set());
  const [expandedTriggerDetails, setExpandedTriggerDetails] = useState<Set<string>>(new Set());
  const [expandedCaseTimelines, setExpandedCaseTimelines] = useState<Set<string>>(new Set());
  const [timelineUserFilter, setTimelineUserFilter] = useState<string>('all');
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // スコープ内のエビデンス
  const inScopeRecords = data.filter((r) => r.evidence_confirm === 1 && r.scope_final === 'in_scope');
  const totalUserCount = useMemo(() => {
    const ids = new Set<string>();
    data.forEach((r) => {
      if (r.user_id) ids.add(r.user_id);
    });
    return ids.size;
  }, [data]);

  // トリガー->エビデンスのペア
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

  const userStageChanges = useMemo(() => {
    type DomainStage = { firstStage?: number; maxStage?: number; delta?: number };
    type UserStage = {
      userId: string;
      firstStage?: number;
      maxStage?: number;
      delta?: number;
      selfEfficacyAcquired: boolean;
      selfEfficacyHits: number;
      selfEfficacyTotal: number;
      domainChanges: Record<string, DomainStage>;
    };

    const buckets: Record<string, typeof inScopeRecords> = {};
    inScopeRecords.forEach((record) => {
      if (!record.user_id) return;
      if (!buckets[record.user_id]) buckets[record.user_id] = [];
      buckets[record.user_id].push(record);
    });

    const byUser: Record<string, UserStage> = {};
    Object.entries(buckets).forEach(([userId, records]) => {
      const sorted = [...records].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      const stageRecords = sorted.filter((r) => getStageScore(r.evidence_type_final) !== undefined);

      const firstStage = stageRecords.length > 0 ? getStageScore(stageRecords[0].evidence_type_final) : undefined;
      let maxStage = firstStage;
      stageRecords.forEach((r) => {
        const score = getStageScore(r.evidence_type_final);
        if (score !== undefined) maxStage = maxStage !== undefined ? Math.max(maxStage, score) : score;
      });

      const delta = firstStage !== undefined && maxStage !== undefined ? maxStage - firstStage : undefined;
      const selfEfficacyHits = sorted.filter((r) => r.self_efficacy_final === 1).length;
      const selfEfficacyTotal = sorted.filter((r) => r.self_efficacy_final !== undefined).length;

      const domainBuckets: Record<string, typeof sorted> = {};
      sorted.forEach((r) => {
        const domain = r.goal_domain_final || 'その他';
        if (!domainBuckets[domain]) domainBuckets[domain] = [];
        domainBuckets[domain].push(r);
      });

      const domainChanges: Record<string, DomainStage> = {};
      Object.entries(domainBuckets).forEach(([domain, domainRecords]) => {
        const domainSorted = [...domainRecords].sort(
          (a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()
        );
        const domainStageRecords = domainSorted.filter((r) => getStageScore(r.evidence_type_final) !== undefined);
        if (domainStageRecords.length === 0) {
          domainChanges[domain] = {};
          return;
        }
        const domainFirst = getStageScore(domainStageRecords[0].evidence_type_final);
        let domainMax = domainFirst;
        domainStageRecords.forEach((r) => {
          const score = getStageScore(r.evidence_type_final);
          if (score !== undefined) domainMax = domainMax !== undefined ? Math.max(domainMax, score) : score;
        });
        domainChanges[domain] = {
          firstStage: domainFirst,
          maxStage: domainMax,
          delta: domainFirst !== undefined && domainMax !== undefined ? domainMax - domainFirst : undefined,
        };
      });

      byUser[userId] = {
        userId,
        firstStage,
        maxStage,
        delta,
        selfEfficacyAcquired: selfEfficacyHits > 0,
        selfEfficacyHits,
        selfEfficacyTotal,
        domainChanges,
      };
    });

    return { byUser, users: Object.values(byUser) };
  }, [inScopeRecords]);

  const aggregateStageChanges = useMemo(() => {
    const transitionDistribution: Record<string, number> = {};
    const domainDeltaMatrix: Record<string, Record<string, number>> = {};
    let selfEfficacyCount = 0;

    userStageChanges.users.forEach((user) => {
      if (user.selfEfficacyAcquired) selfEfficacyCount += 1;
      if (user.firstStage !== undefined && user.maxStage !== undefined) {
        const label = classifyTransition(user.firstStage, user.maxStage);
        transitionDistribution[label] = (transitionDistribution[label] || 0) + 1;
      }

      Object.entries(user.domainChanges).forEach(([domain, change]) => {
        if (change.delta === undefined) return;
        const bucket = change.delta >= 3 ? '3+' : String(change.delta);
        if (!domainDeltaMatrix[domain]) {
          domainDeltaMatrix[domain] = { '0': 0, '1': 0, '2': 0, '3+': 0 };
        }
        domainDeltaMatrix[domain][bucket] = (domainDeltaMatrix[domain][bucket] || 0) + 1;
      });
    });

    return {
      transitionDistribution,
      domainDeltaMatrix,
      selfEfficacyCount,
      totalUsers: totalUserCount,
    };
  }, [userStageChanges, totalUserCount]);

  const caseTimelines = useMemo(() => {
    type TimelinePair = {
      triggerDate: string;
      triggerTypes: string[];
      triggerText: string;
      evidenceDate: string;
      evidenceType: string;
      evidenceText: string;
      stageChange?: { from?: number; to?: number; delta?: number };
      selfEfficacyAcquired: boolean;
      daysSincePrev?: number;
    };
    type Timeline = {
      userId: string;
      domain: string;
      pairs: TimelinePair[];
      totalChange?: number;
      firstStage?: number;
      maxStage?: number;
      effectiveTriggers: string[];
    };

    const buckets: Record<string, { userId: string; domain: string; pairs: Array<{ evidence: typeof inScopeRecords[0]; trigger: typeof data[0] }> }> = {};
    linkedPairs.forEach(({ evidence, trigger }) => {
      if (!trigger) return;
      const userId = evidence.user_id;
      if (!userId) return;
      const domain = evidence.goal_domain_final || 'その他';
      const key = `${userId}|||${domain}`;
      if (!buckets[key]) buckets[key] = { userId, domain, pairs: [] };
      buckets[key].pairs.push({ evidence, trigger });
    });

    const timelinesByUser: Record<string, Timeline[]> = {};
    Object.values(buckets).forEach((bucket) => {
      const sortedPairs = [...bucket.pairs].sort(
        (a, b) => new Date(a.evidence.datetime).getTime() - new Date(b.evidence.datetime).getTime()
      );
      const domainChange = userStageChanges.byUser[bucket.userId]?.domainChanges[bucket.domain];
      let lastStage = domainChange?.firstStage;
      let lastEvidenceDate: Date | null = null;
      const effectiveTriggerSet = new Set<string>();

      const pairs: TimelinePair[] = sortedPairs.map(({ evidence, trigger }) => {
        const currentStage = getStageScore(evidence.evidence_type_final);
        const fromStage = lastStage ?? currentStage;
        const delta =
          fromStage !== undefined && currentStage !== undefined ? currentStage - fromStage : undefined;
        if (currentStage !== undefined) lastStage = currentStage;

        const evidenceDate = new Date(evidence.datetime);
        const daysSincePrev =
          lastEvidenceDate !== null
            ? Math.floor((evidenceDate.getTime() - lastEvidenceDate.getTime()) / (1000 * 60 * 60 * 24))
            : undefined;
        lastEvidenceDate = evidenceDate;

        const topTrigger = getHighestPriorityTrigger(trigger.trigger_type_final);
        if (topTrigger && delta !== undefined && delta > 0) effectiveTriggerSet.add(topTrigger);

        return {
          triggerDate: trigger.datetime,
          triggerTypes: trigger.trigger_type_final || [],
          triggerText: trigger.text_raw || '',
          evidenceDate: evidence.datetime,
          evidenceType: evidence.evidence_type_final || 'unknown',
          evidenceText: evidence.text_raw || '',
          stageChange: { from: fromStage, to: currentStage, delta },
          selfEfficacyAcquired: evidence.self_efficacy_final === 1,
          daysSincePrev,
        };
      });

      const timeline: Timeline = {
        userId: bucket.userId,
        domain: bucket.domain,
        pairs,
        totalChange: domainChange?.delta,
        firstStage: domainChange?.firstStage,
        maxStage: domainChange?.maxStage,
        effectiveTriggers: Array.from(effectiveTriggerSet),
      };

      if (!timelinesByUser[bucket.userId]) timelinesByUser[bucket.userId] = [];
      timelinesByUser[bucket.userId].push(timeline);
    });

    Object.values(timelinesByUser).forEach((timelines) => {
      timelines.sort((a, b) => a.domain.localeCompare(b.domain));
    });

    return timelinesByUser;
  }, [linkedPairs, userStageChanges, data]);

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

        if (r.user_id) {
          if (!byUser[r.user_id]) byUser[r.user_id] = { triggers: {}, domains: {} };
          if (topTrigger) {
            if (!byUser[r.user_id].triggers[topTrigger]) {
              byUser[r.user_id].triggers[topTrigger] = { total: 0, success: 0, evidenceTypes: {} };
            }
            byUser[r.user_id].triggers[topTrigger].total++;
          }
        }
      });

    // スコープ内にリンクされたペアから成功をカウント
    linkedPairs.forEach(({ evidence, trigger }) => {
      if (!trigger?.trigger_type_final) return;

      const topTrigger = getHighestPriorityTrigger(trigger.trigger_type_final);
      if (!topTrigger) return;

      const eTypes = splitEvidenceTypes(evidence.evidence_type_final);
      const domain = evidence.goal_domain_final || 'その他';
      const userId = evidence.user_id;

      // 全体集計
      if (overall[topTrigger]) {
        overall[topTrigger].success++;
        if (eTypes.length === 0) {
          overall[topTrigger].evidenceTypes.unknown = (overall[topTrigger].evidenceTypes.unknown || 0) + 1;
        } else {
          eTypes.forEach((eType) => {
            overall[topTrigger].evidenceTypes[eType] = (overall[topTrigger].evidenceTypes[eType] || 0) + 1;
          });
        }
      }

      // ドメイン別集計
      if (!byDomain[domain]) byDomain[domain] = {};
      if (!byDomain[domain][topTrigger]) {
        byDomain[domain][topTrigger] = { total: 0, success: 0, evidenceTypes: {} };
      }
      byDomain[domain][topTrigger].success++;
      if (eTypes.length === 0) {
        byDomain[domain][topTrigger].evidenceTypes.unknown =
          (byDomain[domain][topTrigger].evidenceTypes.unknown || 0) + 1;
      } else {
        eTypes.forEach((eType) => {
          byDomain[domain][topTrigger].evidenceTypes[eType] =
            (byDomain[domain][topTrigger].evidenceTypes[eType] || 0) + 1;
        });
      }

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
    const sourceRecords = data.filter((r) => !r.exclude_flag);
    const filteredRecords =
      timelineUserFilter === 'all'
        ? sourceRecords
        : sourceRecords.filter((r) => r.user_id === timelineUserFilter);

    if (filteredRecords.length === 0) return { weeks: [], domainWeekly: {}, triggerWeekly: {} };

    const sortedRecords = [...filteredRecords].sort(
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
        const types = splitEvidenceTypes(r.evidence_type_final);
        if (types.length === 0) {
          weeks[week].types.unknown = (weeks[week].types.unknown || 0) + 1;
        } else {
          types.forEach((type) => {
            weeks[week].types[type] = (weeks[week].types[type] || 0) + 1;
          });
        }

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
  }, [data, timelineUserFilter]);

  const timelineUserIds = useMemo(() => {
    const ids = new Set<string>();
    data.forEach((r) => {
      if (r.user_id) ids.add(r.user_id);
    });
    return Array.from(ids).sort();
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
        record.text_raw,
        record.evidence_type_final || '',
        record.scope_final || '',
        record.goal_domain_final || '',
        record.linked_prev_id || '',
        linkedRecord?.trigger_type_final.join(';') || '',
      ]
        .map((value) => escapeCsvField(String(value)))
        .join(',');
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

  const handleExportFullCSV = () => {
    const headers = [...FULL_DATA_COLUMNS];

    const rows = data.map((record) => {
      return [
        record.id,
        record.datetime,
        record.speaker,
        record.user_id || '',
        record.text_raw,
        record.exclude_flag ? '1' : '0',
        String(record.evidence_anchor ?? 0),
        record.evidence_confirm !== undefined ? String(record.evidence_confirm) : '',
        record.evidence_type_final || '',
        record.scope_final || '',
        record.goal_domain_final || '',
        record.linked_prev_id || '',
        record.trigger_excluded ? '1' : '0',
        record.trigger_type_final?.join(';') || '',
      ]
        .map((value) => escapeCsvField(String(value)))
        .join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([CSV_BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'analysis'}_full.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportCSV = async (file: File) => {
    const result = await importAnalyzedCsv(file);
    setData(result.records);
    return { mode: result.mode, count: result.count };
  };

  const handleImportChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const result = await handleImportCSV(file);
      window.alert(
        result.mode === 'full'
          ? `フルデータCSVをインポートしました（${result.count}件）`
          : `エビデンスCSVをインポートしました（${result.count}件）`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'CSVの読み込みに失敗しました';
      window.alert(`インポートエラー: ${message}`);
    } finally {
      event.target.value = '';
    }
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
    const types = splitEvidenceTypes(r.evidence_type_final);
    if (types.length === 0) {
      acc.unknown = (acc.unknown || 0) + 1;
    } else {
      types.forEach((type) => {
        acc[type] = (acc[type] || 0) + 1;
      });
    }
    return acc;
  }, {} as Record<string, number>);

  const domainCounts = inScopeRecords.reduce((acc, r) => {
    const domain = r.goal_domain_final || 'unknown';
    acc[domain] = (acc[domain] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const domains = Object.keys(domainCounts).filter((d) => d !== 'unknown');
  const filteredDomainTriggers = Object.entries(triggerStats.byDomain)
    .map(([domain, triggers]) => {
      const filtered = Object.entries(triggers).filter(([type]) => (TRIGGER_PRIORITY[type] || 4) <= 2);
      if (filtered.length === 0) return null;
      return { domain, triggers: filtered };
    })
    .filter((entry): entry is { domain: string; triggers: Array<[string, { total: number; success: number; evidenceTypes: Record<string, number> }]> } => entry !== null);
  const transitionOrder = ['変化なし', '関心→意図', '意図→計画', '計画→実行', '実行→維持'];
  const transitionEntries = Object.entries(aggregateStageChanges.transitionDistribution).sort((a, b) => {
    const aIndex = transitionOrder.indexOf(a[0]);
    const bIndex = transitionOrder.indexOf(b[0]);
    if (aIndex === -1 && bIndex === -1) return a[0].localeCompare(b[0]);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Step 11: 整形・出力</h2>
      <p className="text-gray-600 mb-6">
        分析結果のレポートとエクスポート
      </p>

      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={handleImportClick}
          className="px-4 py-2 rounded border border-gray-300 text-gray-600 text-sm hover:bg-gray-50"
        >
          分析済みCSVをインポート
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImportChange}
        />
      </div>

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
          {/* フェーズ遷移分布 */}
          <div className="bg-indigo-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">フェーズ遷移分布</h3>
            <div className="space-y-2 text-sm">
              {transitionEntries.map(([label, count]) => {
                const maxCount = Math.max(...Object.values(aggregateStageChanges.transitionDistribution), 1);
                const barWidth = Math.max((count / maxCount) * 100, 5);
                return (
                  <div key={label} className="flex items-center gap-3">
                    <span className="w-36 text-gray-600">{label}</span>
                    <div className="flex-1 bg-white rounded h-2 overflow-hidden">
                      <div className="bg-indigo-500 h-2" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="w-20 text-right font-medium">{count}人</span>
                  </div>
                );
              })}
              {Object.keys(aggregateStageChanges.transitionDistribution).length === 0 && (
                <p className="text-gray-500 text-sm">ステージ情報が不足しているため集計できません</p>
              )}
            </div>
            <div className="mt-4 pt-3 border-t text-sm text-gray-600">
              自己効力感【参考値】:{' '}
              {aggregateStageChanges.totalUsers > 0
                ? `${aggregateStageChanges.selfEfficacyCount}/${aggregateStageChanges.totalUsers}人 が自己効力感を獲得`
                : '対象ユーザーがありません'}
            </div>
            <p className="text-xs text-gray-500 mt-1">※自己効力感はデータ取得が不完全なため参考値として扱います</p>
          </div>

          {/* ドメイン×変化幅 */}
          <div className="bg-white border rounded-lg p-4">
            <h3 className="font-medium mb-4">ドメイン × 変化幅</h3>
            {Object.keys(aggregateStageChanges.domainDeltaMatrix).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="text-sm w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="py-1 pr-4">ドメイン</th>
                      <th className="py-1 px-2 text-center">変化なし</th>
                      <th className="py-1 px-2 text-center">+1</th>
                      <th className="py-1 px-2 text-center">+2</th>
                      <th className="py-1 px-2 text-center">+3以上</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(aggregateStageChanges.domainDeltaMatrix).map(([domain, counts]) => (
                      <tr key={domain}>
                        <td className="py-1 pr-4 font-medium">{domain}</td>
                        <td className="py-1 px-2 text-center">{counts['0'] || 0}</td>
                        <td className="py-1 px-2 text-center">{counts['1'] || 0}</td>
                        <td className="py-1 px-2 text-center">{counts['2'] || 0}</td>
                        <td className="py-1 px-2 text-center">{counts['3+'] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500 text-sm">ステージ情報が不足しているため集計できません</p>
            )}
          </div>

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
                  - {domain} ({phases.length}件)
                </h4>
                <div className="text-sm text-gray-700 pl-4">
                  {phases.map((phase, idx) => (
                    <span key={phase.id}>
                      {idx > 0 && <span className="text-gray-400"> -&gt; </span>}
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

          {/* 介入タイプ別集計（全体集計） */}
          <div className="bg-green-50 rounded-lg p-4">
            <h3 className="font-medium mb-4">介入タイプ別 集計（スコープ内のみ）</h3>
            <p className="text-xs text-gray-500 mb-3">
              ※ P1（実行提案/根拠提示/リフレーミング）&gt; P2（行動継続後押し）&gt; P3 の優先度で最上位のみカウント
            </p>
            <div className="space-y-3">
              {Object.entries(triggerStats.overall)
                .sort((a, b) => (b[1].success / b[1].total || 0) - (a[1].success / a[1].total || 0))
                .map(([type, stats]) => {
                  const priority = TRIGGER_PRIORITY[type] || 4;
                  return (
                    <div key={type} className="text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-green-800">{type}</span>
                        <span className="text-xs text-gray-400">(P{priority})</span>
                        <span>: 使用 {stats.total}件・成功 {stats.success}件</span>
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
            <h3 className="font-medium mb-4">ドメイン別 介入集計</h3>
            {filteredDomainTriggers.length > 0 ? (
              <div className="space-y-4">
                {filteredDomainTriggers.map(({ domain, triggers }) => (
                  <div key={domain}>
                    <h4 className="text-sm font-medium text-yellow-800 mb-2">- {domain}</h4>
                    <div className="pl-4 space-y-1">
                      {triggers
                        .sort((a, b) => b[1].success - a[1].success)
                        .map(([type, stats]) => (
                          <div key={type} className="text-sm text-gray-700">
                            {type}: 成功 {stats.success}件
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
              <p className="text-gray-500 text-sm">P1/P2のトリガーが付与されたデータがありません</p>
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
              onClick={handleExportFullCSV}
              className="px-6 py-3 rounded-lg font-medium bg-gray-600 hover:bg-gray-700 text-white"
            >
              フルデータCSVでダウンロード
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
                      -&gt; {evidence.evidence_type_final}
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
                    <span className="text-gray-400 text-lg">down</span>
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
          <div className="bg-white border rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="text-sm font-medium text-gray-600">ユーザーIDで絞り込み</label>
              <select
                className="border rounded px-3 py-2 text-sm w-full sm:w-64"
                value={timelineUserFilter}
                onChange={(e) => setTimelineUserFilter(e.target.value)}
              >
                <option value="all">全ユーザー</option>
                {timelineUserIds.map((id) => (
                  <option key={id} value={id}>{id}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              選択したユーザーの発話のみで週次集計を再計算します
            </p>
          </div>

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
              <p className="text-gray-500 text-sm">該当するデータがありません</p>
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

              const userStage = userStageChanges.byUser[userId];

              const userDomainTypeCounts = userEvidence.reduce((acc, e) => {
                const domain = e.goal_domain_final || 'その他';
                if (!acc[domain]) acc[domain] = {};
                const types = splitEvidenceTypes(e.evidence_type_final);
                if (types.length === 0) {
                  acc[domain].unknown = (acc[domain].unknown || 0) + 1;
                } else {
                  types.forEach((type) => {
                    acc[domain][type] = (acc[domain][type] || 0) + 1;
                  });
                }
                return acc;
              }, {} as Record<string, Record<string, number>>);

              const domainSummary = Object.entries(userDomainTypeCounts).map(([domain, counts]) => {
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
                if (!top) return `${domain}: データ不足`;
                return `${domain}: ${top[0]}が多め(${top[1]}件)`;
              });

              const stageSummary =
                userStage && userStage.firstStage !== undefined && userStage.maxStage !== undefined
                  ? `${formatStage(userStage.firstStage)} → ${formatStage(userStage.maxStage)} [${formatDelta(userStage.delta)}]`
                  : 'ステージ情報が不足しています';

              const selfEfficacySummary =
                userStage && userStage.selfEfficacyTotal > 0
                  ? `${userStage.selfEfficacyAcquired ? '獲得あり ✓' : '獲得なし'} ${userStage.selfEfficacyHits}件`
                  : 'データなし';

              const domainStageEntries = Object.entries(userStage?.domainChanges || {});
              const maxDomainDelta = Math.max(
                ...domainStageEntries.map(([, change]) => change.delta ?? 0),
                1
              );
              const userTimelines = caseTimelines[userId] || [];

              const triggerTrend = Object.entries(userData.triggers)
                .map(([type, stats]) => {
                  const rate = stats.total > 0 ? stats.success / stats.total : null;
                  return { type, stats, rate };
                })
                .sort((a, b) => {
                  const rateDiff = (b.rate ?? -1) - (a.rate ?? -1);
                  if (rateDiff !== 0) return rateDiff;
                  return b.stats.success - a.stats.success;
                })
                .slice(0, 3);

              return (
                <div key={userId} className="bg-white border rounded-lg p-4">
                  <h3 className="font-bold text-lg mb-4 text-purple-800">
                    ユーザー: {userId}
                  </h3>

                  {/* 分析サマリー */}
                  <div className="bg-purple-50 rounded p-3 mb-4">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">分析サマリー（観測できた範囲）</h4>
                    <div className="text-sm text-gray-700 space-y-1">
                      <div>
                        <span className="text-gray-500">分析期間:</span>{' '}
                        {userEvidence.length > 0
                          ? `${userEvidence[0].datetime.slice(0, 10)} 〜 ${userEvidence[userEvidence.length - 1].datetime.slice(0, 10)}`
                          : '該当データなし'}
                      </div>
                      <div>
                        <span className="text-gray-500">ステージ変化:</span>{' '}
                        {stageSummary}
                      </div>
                      <div>
                        <span className="text-gray-500">自己効力感【参考値】:</span>{' '}
                        {selfEfficacySummary}
                      </div>
                      <div>
                        <span className="text-gray-500">ドメイン別の変化:</span>{' '}
                        {domainSummary.length > 0 ? domainSummary.join(' / ') : '該当データなし'}
                      </div>
                      <div>
                        <span className="text-gray-500">関連が見られた介入タイプの傾向:</span>{' '}
                        {triggerTrend.length > 0
                          ? triggerTrend.map(({ type, stats }) => `${type}（成功${stats.success}件）`).join(' / ')
                          : 'リンク済みの介入が少なく、傾向は判断できません'}
                      </div>
                    </div>
                  </div>

                  {/* ドメイン */}
                  <div className="mb-4">
                    <span className="text-sm font-medium text-gray-600">ドメイン: </span>
                    <span className="text-sm">
                      {Object.entries(userData.domains).map(([d, c]) => `${d}(${c}件)`).join(', ') || 'なし'}
                    </span>
                  </div>

                  {/* ドメイン別変化 */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">ドメイン別変化</h4>
                    {domainStageEntries.length > 0 ? (
                      <div className="space-y-2">
                        {domainStageEntries.map(([domain, change]) => {
                          const delta = change.delta ?? 0;
                          const barWidth = Math.max((delta / maxDomainDelta) * 100, 8);
                          return (
                            <div key={domain} className="text-sm">
                              <div className="flex items-center gap-2">
                                <span className="w-24 text-gray-600">{domain}</span>
                                <span className="text-gray-700">
                                  {formatStage(change.firstStage)} → {formatStage(change.maxStage)} [{formatDelta(change.delta)}]
                                </span>
                              </div>
                              <div className="ml-24 mt-1">
                                <div className="bg-purple-100 h-2 rounded">
                                  <div className="bg-purple-500 h-2 rounded" style={{ width: `${barWidth}%` }} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">ドメイン別のステージ情報がありません</p>
                    )}
                  </div>

                  {/* 行動変容の流れ */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">行動変容の流れ</h4>
                    <div className="space-y-2 pl-2 border-l-2 border-purple-200">
                      {userEvidence.map((evidence) => {
                        const linkedTrigger = data.find((r) => r.id === evidence.linked_prev_id);
                        const topTrigger = linkedTrigger ? getHighestPriorityTrigger(linkedTrigger.trigger_type_final) : null;
                        const triggerExpanded = expandedTriggerDetails.has(evidence.id);

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
                            <span
                              className="text-gray-600 ml-1 cursor-pointer hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                const newSet = new Set(expandedTimelineTexts);
                                newSet.has(evidence.id) ? newSet.delete(evidence.id) : newSet.add(evidence.id);
                                setExpandedTimelineTexts(newSet);
                              }}
                              title="クリックで全文表示"
                            >
                              {expandedTimelineTexts.has(evidence.id)
                                ? `「${evidence.text_raw}」`
                                : `「${evidence.text_raw.slice(0, 25)}...」`
                              }
                              #{evidence.id}
                            </span>
                            {topTrigger && (
                              <span className="text-xs text-gray-400 ml-1">
                                &lt;- {topTrigger}
                              </span>
                            )}
                            {linkedTrigger && (
                              <div className="ml-4 mt-1">
                                <button
                                  className="text-xs text-blue-600 hover:underline"
                                  onClick={() => {
                                    const newSet = new Set(expandedTriggerDetails);
                                    newSet.has(evidence.id) ? newSet.delete(evidence.id) : newSet.add(evidence.id);
                                    setExpandedTriggerDetails(newSet);
                                  }}
                                >
                                  {triggerExpanded ? '−' : '+'} 介入側の発話を{triggerExpanded ? '非表示' : '表示'}
                                </button>
                                {triggerExpanded && (
                                  <div className="mt-2 bg-blue-50 p-2 rounded">
                                    <div className="text-xs text-blue-600 mb-1">
                                      介入側 #{linkedTrigger.id}
                                    </div>
                                    <div className="text-xs text-gray-500 mb-1">
                                      {linkedTrigger.trigger_type_final?.length
                                        ? linkedTrigger.trigger_type_final.join(' / ')
                                        : 'トリガー未分類'}
                                    </div>
                                    <div className="text-sm text-gray-800">{linkedTrigger.text_raw}</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ケース詳細タイムライン */}
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-gray-600 mb-2">ケース詳細タイムライン</h4>
                    {userTimelines.length > 0 ? (
                      <div className="space-y-3">
                        {userTimelines.map((timeline) => {
                          const key = `${timeline.userId}::${timeline.domain}`;
                          const expanded = expandedCaseTimelines.has(key);
                          const headerText = `${timeline.domain} ${formatStage(timeline.firstStage)} → ${formatStage(timeline.maxStage)} [${formatDelta(timeline.totalChange)}]`;
                          return (
                            <div key={key} className="border rounded-lg overflow-hidden">
                              <button
                                className="w-full px-4 py-2 bg-gray-50 flex items-center justify-between text-left"
                                onClick={() => {
                                  const newSet = new Set(expandedCaseTimelines);
                                  newSet.has(key) ? newSet.delete(key) : newSet.add(key);
                                  setExpandedCaseTimelines(newSet);
                                }}
                              >
                                <span className="text-sm font-medium text-gray-800">
                                  {expanded ? '−' : '+'} {headerText}
                                </span>
                                <span className="text-xs text-gray-500">{expanded ? '閉じる' : '開く'}</span>
                              </button>
                              {expanded && (
                                <div className="p-4 space-y-4 bg-white">
                                  {timeline.pairs.map((pair, idx) => {
                                    const triggerText =
                                      pair.triggerText.length > 80
                                        ? `${pair.triggerText.slice(0, 80)}...`
                                        : pair.triggerText;
                                    const evidenceText =
                                      pair.evidenceText.length > 80
                                        ? `${pair.evidenceText.slice(0, 80)}...`
                                        : pair.evidenceText;
                                    const stageText = pair.stageChange
                                      ? `${formatStage(pair.stageChange.from)} → ${formatStage(pair.stageChange.to)} [${formatDelta(pair.stageChange.delta)}]`
                                      : 'ステージ情報なし';
                                    return (
                                      <div key={`${key}-${idx}`} className="text-sm">
                                        <div className="text-gray-500 mb-1">
                                          日付: {pair.triggerDate ? pair.triggerDate.slice(0, 10) : '日付不明'}
                                        </div>
                                        <div className="pl-3 border-l-2 border-blue-200">
                                          <div className="text-xs text-blue-600 mb-1">提示</div>
                                          <div className="text-gray-800">{triggerText || '（記録なし）'}</div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {pair.triggerTypes.length > 0 ? pair.triggerTypes.join(' / ') : 'トリガー未分類'}
                                          </div>
                                        </div>
                                        <div className="text-center text-gray-400 my-2">↓</div>
                                        <div className="pl-3 border-l-2 border-green-200">
                                          <div className="flex items-center gap-2 text-xs text-green-600 mb-1">
                                            <span>受け止め</span>
                                            {pair.daysSincePrev !== undefined && (
                                              <span className="text-gray-400">[{pair.daysSincePrev}日後]</span>
                                            )}
                                          </div>
                                          <div className="text-gray-800">{evidenceText || '（記録なし）'}</div>
                                          <div className="text-xs text-gray-500 mt-1">
                                            {pair.evidenceType}
                                          </div>
                                          <div className="text-xs text-gray-600 mt-1">
                                            ステージ: {stageText}
                                            {pair.selfEfficacyAcquired && (
                                              <span className="text-emerald-600 ml-2">自己効力感【参考】: ✓</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                  <div className="text-xs text-gray-500 pt-3 border-t">
                                    合計変化: {formatStage(timeline.firstStage)} → {formatStage(timeline.maxStage)} [{formatDelta(timeline.totalChange)}]
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    関連が見られた介入:{' '}
                                    {timeline.effectiveTriggers.length > 0 ? timeline.effectiveTriggers.join(', ') : '該当なし'}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">リンク済みのケースがありません</p>
                    )}
                  </div>

                  {/* 関連が見られた介入 */}
                  <div className="bg-purple-50 rounded p-3">
                    <h4 className="text-sm font-medium text-purple-700 mb-2">関連が見られた介入</h4>
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
                <span className="text-gray-400 mx-2">-&gt;</span>
                <span className="text-gray-800">{log.result}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
