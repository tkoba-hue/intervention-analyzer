# テキストチャット介入分析ツール

## 必読資料

**計画・実装前に必ず参照:**

| 資料 | ローカル | Google Drive |
|------|----------|--------------|
| 工程仕様 | `docs/01_pipeline_spec.md` | [リンク](https://drive.google.com/file/d/1qgSpRgndhEeR5qRehCEE9CxrJXA9q53p) |
| 定義一覧 | `docs/00_definition_list.md` | [リンク](https://drive.google.com/file/d/1XVt4YYYOWtPMgXy83Cdr6U0_FciD6NXs) |
| 全参照資料 | `REFERENCES.md` | - |

## ワークフロー構造（フェーズ式）

```
┌─────────────────────────────────────────────────────────────────────┐
│  P1 共通        P2 分岐処理                         P3 統合        │
│                                                                     │
│              ┌─ 🔵 Trigger ─[2A-1]─[2A-2]─[2A-3]───────────────┐  │
│  [1-1]─[1-2]─┤                                                   ├─[3-1]─[3-2]─[3-3] │
│              └─ 🟢 Evidence ─[2B-1]─[2B-2]─[2B-3]──────────────┘  │
│                                                                     │
│  正規化 除外    介入発話を処理   参加者の反応を処理    リンク ゴール 出力│
└─────────────────────────────────────────────────────────────────────┘
```

| フェーズ | 工程ID | 内容 | 対象データ |
|---------|--------|------|-----------|
| **P1 共通** | 1-1 | 正規化 | 全発話 |
| | 1-2 | 除外マーク | 全発話 |
| **P2A Trigger** | 2A-1 | 候補抽出（除外判定） | 🔵 other（介入） |
| | 2A-2 | trigger自動付与 | 🔵 other |
| | 2A-3 | trigger確定（低確信度のみ目視） | 🔵 other |
| **P2B Evidence** | 2B-1 | 候補抽出（anchor抽出） | 🟢 participant（反応） |
| | 2B-2 | evidence確定 | 🟢 participant |
| | 2B-3 | 分類（type + スコープ内外） | 🟢 participant |
| **P3 統合** | 3-1 | 文脈リンク | 両方統合 |
| | 3-2 | goal_domain | スコープ内 |
| | 3-3 | 出力 | 最終データ |

## 工程区分ルール

- ②機械 → 自動判定が正式仕様 →「自動判定実行」
- ③人間（機械任意）→ デモ用 →「デモ用仮判定」
- **2B-3のみ「デモ用仮判定」**、他は「自動判定実行」

## 主要定義変更

- **scope**: `in_scope`（スコープ内）/ `out_of_scope`（スコープ外）の2択
- **evidence_type**: `outcome_report` → `situation_report`（状況報告）に変更

## デプロイ

| 環境 | URL |
|------|-----|
| Frontend | https://chat-intervention-analyzer.vercel.app |
| Backend | https://intervention-analyzer-production.up.railway.app |
| 認証 | demo / intervention2024 |

### デプロイ手順

```bash
# 1. 変更をコミット
git add -A
git commit -m "変更内容"

# 2. プッシュ（両方自動デプロイ）
git push
# → Frontend: Vercel自動デプロイ
# → Backend: Railway自動デプロイ

# 手動デプロイ（必要時のみ）
cd frontend && vercel --prod
```

## ローカル開発

```bash
cd frontend && npm run dev   # localhost:3000
cd backend && uvicorn main:app --reload  # localhost:8000
```

## 実装ステータス（フェーズ式）

### 完了 (2026-02-22)

| 工程ID | 機能 | ボタン表記 | 状態 |
|--------|------|-----------|------|
| 1-1 | 正規化 | 処理開始 | ✅ |
| 1-2 | 除外マーク | 処理開始 | ✅ |
| 2A-1〜3 | Trigger処理（候補→自動→確定） | フェーズボタン | ✅ |
| 2B-1 | Evidence候補抽出 | 候補抽出実行 | ✅ |
| 2B-2 | Evidence確定 | Yes/No選択 | ✅ |
| 2B-3 | Evidence分類（type+scope） | デモ用仮判定 | ✅ |
| 3-1 | 文脈リンク | 自動リンク実行 | ✅ |
| 3-2 | goal_domain | 自動判定実行 | ✅ |
| 3-3 | レポート出力 | CSV/JSONダウンロード | ✅ |

### 各工程の一括クリアボタン
- 全工程: ✅ 実装済み

## バージョン管理

- `v1.0-linear-workflow`: 線形ワークフロー（旧版）
- 現在: フェーズ式分岐ワークフロー
