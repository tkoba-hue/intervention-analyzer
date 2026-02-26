# テキストチャット介入分析ツール

## 必読資料

**計画・実装前に必ず参照:**

| 資料 | ローカル | Google Drive |
|------|----------|--------------|
| 工程仕様 | `docs/01_pipeline_spec.md` | [リンク](https://drive.google.com/file/d/1qgSpRgndhEeR5qRehCEE9CxrJXA9q53p) |
| 定義一覧 | `docs/00_definition_list.md` | [リンク](https://drive.google.com/file/d/1XVt4YYYOWtPMgXy83Cdr6U0_FciD6NXs) |
| 全参照資料 | `REFERENCES.md` | - |

## ワークフロー構造（線形）

```
[1]→[2]→[3]→[4]→[5]→[6]→[7]→[8]→[9]→[10]→[11]
正規化 除外 候補 自動 確定 候補 確定 分類 リンク ゴール 出力
       ←── Trigger(青) ──→ ←── Evidence(緑) ──→
```

| Step | 内容 | 対象データ | 色 |
|------|------|-----------|-----|
| 1 | 正規化 | 全発話 | - |
| 2 | 除外マーク | 全発話 | - |
| 3 | Trigger候補抽出 | other | 青 |
| 4 | Trigger自動付与 | other | 青 |
| 5 | Trigger確定 | other | 青 |
| 6 | Evidence候補抽出 | participant | 緑 |
| 7 | Evidence確定 | participant | 緑 |
| 8 | Evidence分類 | participant | 緑 |
| 9 | 文脈リンク | 両方 | - |
| 10 | goal_domain | スコープ内 | - |
| 11 | 出力 | 最終 | - |

## 主要定義

- **scope**: `in_scope`（スコープ内）/ `out_of_scope`（スコープ外）の2択
- **evidence_type**: `situation_report`（状況報告）等

## デプロイ

| 環境 | URL |
|------|-----|
| Frontend | https://chat-intervention-analyzer.vercel.app |
| Backend | https://intervention-analyzer-production.up.railway.app |
| 認証 | demo / intervention2024 |

### デプロイ手順

```bash
git add -A && git commit -m "変更内容" && git push
# → Frontend: Vercel自動デプロイ
# → Backend: Railway自動デプロイ
```

## ローカル開発

```bash
cd frontend && npm run dev   # localhost:3000
cd backend && uvicorn main:app --reload  # localhost:8000
```

## バージョン管理

- `v1.0-linear-workflow`: 旧版
- `v2.0-phase-workflow`: 分岐ワークフロー
- 現在: v3 線形ワークフロー（Trigger先行）

## 関連プロジェクト

| プロジェクト | パス | 役割 |
|-------------|------|------|
| **intervention-learning-loop** | `/home/dev/intervention-learning-loop` | 評価・学習ループ（上位プロジェクト） |

本プロジェクトで抽出したTrigger/Evidenceの修正ログは、intervention-learning-loopに送信され、
AIチャットボット改善のための学習データとして活用される。

詳細: `/home/dev/intervention-learning-loop/CLAUDE.md`
