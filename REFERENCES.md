# 参照資料一覧

このプロジェクトの設計・実装で参照する資料。

## ローカルコピー（docs/）

| ファイル | 内容 |
|----------|------|
| `docs/01_pipeline_spec.md` | **工程仕様（②機械/③人間の区分）** |
| `docs/00_definition_list.md` | 定義ファイル一覧 |

## 定義ファイル（backend/definitions/）

| ファイル | 内容 |
|----------|------|
| `evidence_definition_v1.csv` | evidence_type定義 |
| `trigger_definition_v3.csv` | trigger_type定義 |
| `scope_definition_v1.csv` | scope定義 |
| `goal_domain_definition_v1.csv` | goal_domain定義 |

## Google Drive原本

| ファイル名 | リンク |
|-----------|--------|
| 01_pipeline_spec.md | https://drive.google.com/file/d/1qgSpRgndhEeR5qRehCEE9CxrJXA9q53p |
| 00_definition_list.md | https://drive.google.com/file/d/1XVt4YYYOWtPMgXy83Cdr6U0_FciD6NXs |
| 00_README.md | https://drive.google.com/file/d/19l1myVse1f1mu3i4mMPPQzuMgfTQK4yM |
| チャット介入構造_分析手順.md | https://drive.google.com/file/d/1EjTUCUpsiipLvRCVzdpsk8RfVf7r0VPQ |
| チャット介入構造 分析手順 v6.pdf | https://drive.google.com/file/d/1gV1ZNOmaJUwFuv2WNO9rj99_kyXVQsUI |

## 工程区分ルール（01_pipeline_spec.mdより）

| Step | 工程 | 区分 | UI表記 |
|------|------|------|--------|
| 1-3, 5 | 正規化〜strict | ②機械 | - |
| 4 | evidence_confirm | ③人間 | - |
| 6 | evidence_type | ③人間（機械は任意） | **デモ用仮判定** |
| 7 | scope | ②機械→③override | 自動判定実行 |
| 8 | trigger | ②機械→③override | 自動判定実行 |
| 9 | 文脈リンク | ②機械 | 自動リンク実行 |
| 10 | goal_domain | ②機械→③修正 | 自動判定実行 |
