/**
 * Backend API client
 */

const API_BASE = '/api';

export interface TextRecord {
  id: string;
  datetime: string;
  speaker: string;
  text_raw: string;
}

export interface NormalizeResponse {
  records: Array<{
    id: string;
    datetime: string;
    speaker: string;
    text_raw: string;
    text_norm: string;
  }>;
  processed_count: number;
}

export interface ExcludeResponse {
  records: Array<{
    id: string;
    datetime: string;
    speaker: string;
    text_raw: string;
    text_norm?: string;
    exclude_flag: boolean;
    exclude_reason: string | null;
  }>;
  excluded_count: number;
  total_count: number;
}

export interface AnchorResponse {
  records: Array<{
    id: string;
    datetime: string;
    speaker: string;
    text_raw: string;
    text_norm?: string;
    exclude_flag?: boolean;
    exclude_reason?: string | null;
    evidence_anchor: number;
    evidence_anchor_confidence: number;
  }>;
  anchor_count: number;
  total_participant_count: number;
}

export interface TriggerResponse {
  records: Array<{
    id: string;
    trigger_type_auto: string[];
    trigger_type_final: string[];
    [key: string]: unknown;
  }>;
}

export interface ScopeResponse {
  records: Array<{
    id: string;
    scope_auto?: string;
    scope_final?: string;
    [key: string]: unknown;
  }>;
}

export interface GoalDomainResponse {
  records: Array<{
    id: string;
    goal_domain_auto?: string;
    goal_domain_final?: string;
    [key: string]: unknown;
  }>;
}

export interface EvidenceTypeResponse {
  records: Array<{
    id: string;
    evidence_type_auto?: string;
    evidence_type_confidence?: number;
    evidence_type_final?: string;
    [key: string]: unknown;
  }>;
}

export interface DefinitionsResponse {
  evidence_types: Array<{ value: string; description: string }>;
  scope_options: Array<{ value: string; description: string }>;
  trigger_types: Array<{ value: string; priority: number; description: string }>;
  goal_domains: Array<{ value: string; description: string }>;
}

class ApiClient {
  /**
   * Step 1: 正規化
   */
  async normalize(records: TextRecord[]): Promise<NormalizeResponse> {
    const response = await fetch(`${API_BASE}/process/normalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Normalize failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 2: 除外マーク
   */
  async excludeMark(records: unknown[]): Promise<ExcludeResponse> {
    const response = await fetch(`${API_BASE}/process/exclude-mark`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Exclude mark failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 3: Anchor候補抽出
   */
  async extractAnchors(records: unknown[]): Promise<AnchorResponse> {
    const response = await fetch(`${API_BASE}/process/extract-anchors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Extract anchors failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 6: エビデンスタイプ分類
   */
  async classifyEvidenceType(records: unknown[]): Promise<EvidenceTypeResponse> {
    const response = await fetch(`${API_BASE}/process/classify-evidence-type`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Classify evidence type failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 8: トリガー分類
   */
  async classifyTriggers(records: unknown[]): Promise<TriggerResponse> {
    const response = await fetch(`${API_BASE}/process/classify-triggers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Classify triggers failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 7: スコープ分類
   */
  async classifyScope(records: unknown[]): Promise<ScopeResponse> {
    const response = await fetch(`${API_BASE}/process/classify-scope`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Classify scope failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Step 10: ゴールドメイン分類
   */
  async classifyGoalDomain(records: unknown[]): Promise<GoalDomainResponse> {
    const response = await fetch(`${API_BASE}/process/classify-goal-domain`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    if (!response.ok) {
      throw new Error(`Classify goal domain failed: ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * 定義ファイルの内容を取得
   */
  async getDefinitions(): Promise<DefinitionsResponse> {
    const response = await fetch(`${API_BASE}/process/definitions`);
    if (!response.ok) {
      throw new Error(`Get definitions failed: ${response.statusText}`);
    }
    return response.json();
  }
}

export const api = new ApiClient();
