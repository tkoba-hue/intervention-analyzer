# バージョン履歴

## タグ一覧

| タグ名 | コミット | 説明 | 戻し方 |
|--------|---------|------|--------|
| `v1.0-linear-workflow` | 23532af | Step 8 3段階完了、線形ワークフロー | `git checkout v1.0-linear-workflow` |

---

## v1.0-linear-workflow (2026-02-22)

**コミット:** `23532af`

### 状態
- 11ステップ線形フロー（1→2→3→...→11）
- Step 8: 3段階プロセス（除外→自動付与→目視修正）
- Step 9: 文脈リンクのみ（トリガー編集なし）
- Step 11: 次のステップボタン非表示

### デプロイURL
- Frontend: https://chat-intervention-analyzer.vercel.app
- Backend: https://intervention-analyzer-production.up.railway.app

---

## コミット履歴

| コミット | 内容 |
|---------|------|
| `23532af` | **Step 8を3段階プロセスに再設計** |
| `9d9a208` | Step 8/9 UI改善 + Step 11ボタン非表示 |
| `544053b` | Step 8 UI簡略化 - 自動処理+統計表示のみに |
| `dec2312` | API_BASEを本番バックエンドURLに設定 |
| `1b99c94` | フロントエンドからバックエンドへのAPI接続を修正 |
| `198dbfc` | デプロイ手順・実装ステータス追記 |
| `59465e3` | UIラベル区分・Step 8/9改善・ドキュメント整備 |
| `4074fca` | Step 7 スコープ判定の視覚的差別化 |
| `4234ab8` | BASIC_AUTH_PASS環境変数名に対応 |
| `a86b942` | localhostアクセス時も認証スキップ |
| `80904ce` | **Vercel + Railway デプロイ対応** |
| `fcb23bc` | **テキストチャット介入分析ツール - UX改修完了（初版）** |

---

## マイルストーン

### 初版リリース (fcb23bc)
- 11ステップのパイプライン実装
- 基本的なUI/UX

### デプロイ対応 (80904ce)
- Vercel（フロントエンド）
- Railway（バックエンド）
- Basic認証

### API修正 (dec2312)
- localhost → Railway URL への修正
- 本番環境での動作確認完了

### Step 8 3段階化 (23532af) ← **現在のタグ**
- 除外判定 → 自動付与 → 目視修正
- Step 9からトリガー編集を削除

---

## 今後の予定

### ワークフロー分岐版
- Step 2後に「エビデンス側」「トリガー側」へ分岐
- Step 9で統合
- StepIndicator分岐表示
