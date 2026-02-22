再現用の工程仕様

前提
  入力は発話単位のテーブル
  必須列の例
    participant_id
    record_id_global
    datetime_jst_naive
    speaker_side 参加者 または other
    text_raw
    exclude_reason 任意

工程の区分
  ① 事実  入力データに含まれるもの
  ② 機械  事前に決めた定義やルールに従う処理
  ③ 人間  目視で確定する処理

工程
  1 正規化
    ② HTML除去 改行整形 空白正規化

  2 除外マーク
    ② exclude_reason でスタンプのみ等を識別

  3 evidence_anchor 候補抽出
    ② 参加者発話を対象に 変化 実施 計画 意思 中断 自己効力感 等の語彙パターンで候補化
    ② evidence_anchor 0 1 を付与

  4 evidence_confirm 確定
    ③ evidence_anchor が1の行のみ目視
    ③ evidence_confirm 1 0 を入力
    ③ evidence_reason_if0 を短文で入力

  5 evidence_flag_strict
    ② evidence_anchor 1 かつ evidence_confirm 1 の行を strict とする

  6 evidence_type 付与
    ③ strict 行に対し evidence_type_final を目視で確定
    ② 機械で暫定分類を付けてもよいが 最終は人間が確定

  7 scope 付与
    ② ルールで scope_auto を付与
    ③ scope_override を必要に応じて入力し apply_flag で適用

  8 other 側トリガー付与
    ② other 発話を対象に trigger_type_other_auto を付与
    ③ trigger override を入力し apply_flag で適用
    ② 優先順位ルールで trigger_type_other_final を正規化

  9 文脈リンク
    ② strict 行を起点に 直前の other 発話を linked_prev として結合
    ② 必要に応じて同一エピソード内の別発話も linked_other として結合

  10 goal_domain 付与
    ② scope が goal_related の行を対象に goal_domain_auto を付与
    ② 定義外は その他 に正規化
    ③ 迷うものは人間が修正

  11 分析用の整形
    ② 必要列のみ残し 並び替え 参照用のリンク列を保持したビューを出力

出力
  analysis_ready テーブル
  summary_tables 集計表
