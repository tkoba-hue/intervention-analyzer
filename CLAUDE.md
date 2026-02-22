# テキストチャット介入分析ツール

## 必読資料

**計画・実装前に必ず参照:**

| 資料 | ローカル | Google Drive |
|------|----------|--------------|
| 工程仕様 | `docs/01_pipeline_spec.md` | [リンク](https://drive.google.com/file/d/1qgSpRgndhEeR5qRehCEE9CxrJXA9q53p) |
| 定義一覧 | `docs/00_definition_list.md` | [リンク](https://drive.google.com/file/d/1XVt4YYYOWtPMgXy83Cdr6U0_FciD6NXs) |
| 全参照資料 | `REFERENCES.md` | - |

## 工程区分ルール

- ②機械 → 自動判定が正式仕様 →「自動判定実行」
- ③人間（機械任意）→ デモ用 →「デモ用仮判定」
- **Step 6のみ「デモ用仮判定」**、他は「自動判定実行」

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

## 実装ステータス

### 完了 (2026-02-22)

| Step | 機能 | ボタン表記 | 状態 |
|------|------|-----------|------|
| 1-3 | 正規化〜候補抽出 | - | ✅ |
| 4 | evidence_confirm | - | ✅ |
| 5 | evidence_flag_strict | - | ✅ |
| 6 | evidence_type | デモ用仮判定 | ✅ |
| 7 | scope | 自動判定実行 | ✅ |
| 8 | trigger | 自動判定実行 | ✅ 正規表現パターン追加 |
| 9 | 文脈リンク | 自動リンク実行 | ✅ 表示100文字に拡張 |
| 10 | goal_domain | 自動判定実行 | ✅ |
| 11 | レポート出力 | - | ✅ |

### 各Stepの一括クリアボタン
- Step 4, 6, 7, 8, 9, 10: ✅ 実装済み
