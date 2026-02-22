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

## ローカル開発

```bash
cd frontend && npm run dev   # localhost:3000
cd backend && uvicorn main:app --reload  # localhost:8000
```
