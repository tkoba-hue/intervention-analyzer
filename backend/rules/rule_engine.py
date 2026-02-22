"""
ルールエンジン: 定義ファイルに基づくパターンマッチング
"""
import csv
import re
from pathlib import Path
from dataclasses import dataclass


@dataclass
class EvidenceDefinition:
    kind: str
    label: str
    inclusion: str
    notes: str
    rule_id: str


@dataclass
class TriggerDefinition:
    trigger_type: str
    priority: int
    definition: str
    include_patterns: list[str]
    exclude_patterns: list[str]


@dataclass
class ScopeDefinition:
    scope: str
    definition: str


@dataclass
class GoalDomainDefinition:
    goal_domain: str
    definition: str


class RuleEngine:
    """定義ファイルに基づくルールベースの分類エンジン"""

    def __init__(self, definitions_dir: str | Path):
        self.definitions_dir = Path(definitions_dir)
        self.evidence_defs: list[EvidenceDefinition] = []
        self.trigger_defs: list[TriggerDefinition] = []
        self.scope_defs: list[ScopeDefinition] = []
        self.goal_domain_defs: list[GoalDomainDefinition] = []

        # アンカー語パターン（evidence候補抽出用）
        self.anchor_patterns: list[tuple[re.Pattern, float]] = []

        self._load_definitions()
        self._compile_patterns()

    def _load_definitions(self):
        """定義ファイルを読み込む"""
        # evidence_definition
        evidence_path = self.definitions_dir / "evidence_definition_v1.csv"
        if evidence_path.exists():
            with open(evidence_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.evidence_defs.append(EvidenceDefinition(
                        kind=row.get("kind", ""),
                        label=row.get("label", ""),
                        inclusion=row.get("inclusion", ""),
                        notes=row.get("notes", ""),
                        rule_id=row.get("rule_id", ""),
                    ))

        # trigger_definition
        trigger_path = self.definitions_dir / "trigger_definition_v3.csv"
        if trigger_path.exists():
            with open(trigger_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    include_str = row.get("含める", "")
                    exclude_str = row.get("含めない", "")
                    self.trigger_defs.append(TriggerDefinition(
                        trigger_type=row.get("trigger_type", ""),
                        priority=int(row.get("priority", 3)),
                        definition=row.get("定義", ""),
                        include_patterns=[p.strip() for p in include_str.split("、") if p.strip()],
                        exclude_patterns=[p.strip() for p in exclude_str.split("、") if p.strip()],
                    ))

        # scope_definition
        scope_path = self.definitions_dir / "scope_definition_v1.csv"
        if scope_path.exists():
            with open(scope_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.scope_defs.append(ScopeDefinition(
                        scope=row.get("scope", ""),
                        definition=row.get("定義", ""),
                    ))

        # goal_domain_definition
        goal_path = self.definitions_dir / "goal_domain_definition_v1.csv"
        if goal_path.exists():
            with open(goal_path, encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    self.goal_domain_defs.append(GoalDomainDefinition(
                        goal_domain=row.get("goal_domain", ""),
                        definition=row.get("定義", ""),
                    ))

    def _compile_patterns(self):
        """アンカー語パターンをコンパイル"""
        # 変化・実施・計画・意思・中断・自己効力感等の語彙パターン
        patterns = [
            # 意思表明（高確信度）
            (r"やってみ(ます|よう|たい)", 0.9),
            (r"試してみ(ます|よう|たい)", 0.9),
            (r"始め(ます|ました|たい)", 0.85),
            (r"挑戦(します|したい)", 0.85),

            # 実行報告（高確信度）
            (r"(やり|行い|実行し)ました", 0.9),
            (r"できました", 0.9),
            (r"(歩き|運動し|食べ)ました", 0.85),
            (r"続け(てい|られてい)ます", 0.85),

            # 計画（高確信度）
            (r"(明日|来週|今度).*(します|やります|行きます)", 0.85),
            (r"(予定|計画)して", 0.8),

            # 気づき（中確信度）
            (r"(わかり|理解し|納得し)ました", 0.75),
            (r"(気づき|発見し)ました", 0.75),
            (r"(そうですね|なるほど)", 0.5),

            # 自己効力感（中確信度）
            (r"できそう", 0.8),
            (r"自信(が|を)", 0.75),
            (r"(やれ|続け)そう", 0.75),

            # 障壁（中確信度）
            (r"(できな|難し|無理)", 0.7),
            (r"(痛い|つらい|しんどい)", 0.6),
            (r"(忙し|時間がな)", 0.6),

            # 継続（中確信度）
            (r"(続け|継続し)て", 0.75),
            (r"(習慣|日課)に", 0.7),

            # 結果報告（中確信度）
            (r"(変わり|改善し|良くなり)ました", 0.8),
            (r"(減り|増え)ました", 0.7),
        ]

        self.anchor_patterns = [
            (re.compile(p, re.IGNORECASE), conf)
            for p, conf in patterns
        ]

    def extract_evidence_anchor(self, text: str) -> tuple[bool, float, list[str]]:
        """
        テキストからevidence候補を抽出

        Returns:
            (is_anchor, confidence, matched_patterns): アンカーフラグ、確信度、マッチしたパターン
        """
        max_confidence = 0.0
        matched_patterns: list[str] = []

        for pattern, confidence in self.anchor_patterns:
            match = pattern.search(text)
            if match:
                max_confidence = max(max_confidence, confidence)
                matched_patterns.append(match.group())

        # 確信度0.5以上をアンカーとする
        is_anchor = max_confidence >= 0.5
        return is_anchor, max_confidence, matched_patterns

    def classify_trigger(self, text: str) -> list[tuple[str, int, float]]:
        """
        other発話のトリガー種類を分類

        Returns:
            [(trigger_type, priority, confidence), ...]: マッチしたトリガーのリスト
        """
        matches = []
        matched_types = set()

        # 正規表現パターンでの補助マッチ（より緩い条件）
        regex_patterns = {
            "実行提案": [(r"(やってみ|試してみ|いかが|まず|具体的|提案|方法)", 0.7)],
            "根拠提示": [(r"(という|データ|基準|研究|効果|理由|根拠)", 0.6)],
            "リフレーミング": [(r"(捉え|見方|考え方|という意味|プラス)", 0.6)],
            "行動継続後押し": [(r"(続け|継続|この調子|頑張|維持)", 0.7)],
            "承認": [(r"(素晴らしい|すごい|ありがとう|良い|いいですね|さすが)", 0.7)],
            "ラポール形成": [(r"(お体|体調|気をつけ|季節|お大事|ご自愛)", 0.6)],
            "情報収集": [(r"(いかがでし|どうでし|どのくらい|どんな|教えて)", 0.7)],
            "運用案内": [(r"(設定|不具合|エラー|操作|ログイン|対応)", 0.7)],
        }

        for trigger_type, patterns in regex_patterns.items():
            for pattern, confidence in patterns:
                if re.search(pattern, text):
                    priority = next(
                        (t.priority for t in self.trigger_defs if t.trigger_type == trigger_type),
                        3
                    )
                    matches.append((trigger_type, priority, confidence))
                    matched_types.add(trigger_type)
                    break

        # 既存のCSVパターンマッチも実行
        for trigger_def in self.trigger_defs:
            if trigger_def.trigger_type in matched_types:
                continue

            # マッチしたパターン数をカウント
            match_count = sum(1 for p in trigger_def.include_patterns if p in text)

            # exclude パターンのいずれにもマッチしない
            exclude_match = any(
                p in text for p in trigger_def.exclude_patterns
            )

            if match_count > 0 and not exclude_match:
                # 確信度: マッチパターン数 / 全パターン数（上限1.0、下限0.3）
                pattern_count = max(len(trigger_def.include_patterns), 1)
                confidence = min(0.3 + (match_count / pattern_count) * 0.7, 1.0)
                matches.append((trigger_def.trigger_type, trigger_def.priority, confidence))

        return matches

    def apply_priority_rules(
        self, triggers: list[tuple[str, int, float]]
    ) -> list[tuple[str, int, float]]:
        """
        優先度ルールを適用
        - P1があればP3は除外
        """
        if not triggers:
            return []

        has_p1 = any(p == 1 for _, p, _ in triggers)

        if has_p1:
            # P1がある場合、P3を除外
            return [(t, p, c) for t, p, c in triggers if p <= 2]

        return triggers

    def classify_scope(self, text: str, evidence_type: str | None) -> str:
        """
        スコープを分類（バイナリ: in_scope / out_of_scope）

        in_scope: 目標行動や生活改善に関する変化表明
        out_of_scope: 雑談・ラポール・運用関連・外部要因など
        """
        # スコープ内と判定するキーワード
        in_scope_keywords = [
            # 運動関連
            "運動", "歩", "体操", "筋力", "ストレッチ", "散歩",
            # 栄養関連
            "食", "栄養", "野菜", "たんぱく",
            # 睡眠関連
            "睡眠", "寝", "起き", "眠",
            # 認知機能関連
            "記憶", "脳トレ", "集中",
            # 精神関連
            "気分", "不安", "意欲", "やる気",
            # 社会参加関連
            "外出", "会話", "交流", "趣味",
        ]

        # スコープ外と判定するキーワード（優先チェック）
        out_of_scope_keywords = [
            # 運用関連
            "設定", "不具合", "エラー", "操作", "ログイン", "パスワード",
            # 外部要因
            "天気", "ニュース", "テレビ",
            # サービス関連
            "参加", "退会", "解約",
        ]

        # スコープ外キーワードが含まれていればout_of_scope
        if any(kw in text for kw in out_of_scope_keywords):
            return "out_of_scope"

        # スコープ内キーワードが含まれていればin_scope
        if any(kw in text for kw in in_scope_keywords):
            return "in_scope"

        # デフォルトはスコープ外
        return "out_of_scope"

    def classify_goal_domain(self, text: str) -> str:
        """
        目標ドメインを分類
        """
        domain_keywords = {
            "運動": ["運動", "歩", "体操", "筋力", "ストレッチ", "散歩", "ジム"],
            "栄養": ["食", "栄養", "野菜", "たんぱく", "カロリー", "食事"],
            "睡眠": ["睡眠", "寝", "起き", "昼寝", "眠"],
            "認知機能": ["記憶", "脳トレ", "集中", "物忘れ"],
            "精神": ["気分", "不安", "意欲", "うつ", "ストレス", "やる気"],
            "社会参加": ["外出", "会話", "交流", "友人", "趣味", "サークル"],
        }

        for domain, keywords in domain_keywords.items():
            if any(kw in text for kw in keywords):
                return domain

        return "その他"

    def classify_evidence_type(self, text: str) -> tuple[str | None, float]:
        """
        エビデンスタイプを分類

        Returns:
            (evidence_type, confidence): タイプと確信度
        """
        # パターン定義（確信度付き）
        type_patterns = {
            "action_report": [
                (r"(やり|行い|実行し|実践し)ました", 0.9),
                (r"できました", 0.9),
                (r"(歩き|運動し|食べ|寝|起き)ました", 0.85),
                (r"(した|しました)$", 0.6),
            ],
            "intention": [
                (r"やってみ(ます|よう|たい)", 0.9),
                (r"試してみ(ます|よう|たい)", 0.9),
                (r"(してみ|やろう)(ます|かな|と思)", 0.8),
            ],
            "plan": [
                (r"(明日|来週|今度|今週).*(します|やります|行きます)", 0.85),
                (r"(予定|計画)して", 0.8),
                (r"(〜しよう|〜する予定)", 0.75),
            ],
            "awareness": [
                (r"(わかり|理解し|納得し)ました", 0.85),
                (r"(気づき|発見し)ました", 0.85),
                (r"(そうですね|なるほど|そうなんですね)", 0.7),
            ],
            "self_efficacy": [
                (r"できそう", 0.9),
                (r"自信(が|を)", 0.85),
                (r"(やれ|続け|頑張れ)そう", 0.8),
            ],
            "barrier": [
                (r"(できな|難し|無理|だめ)", 0.8),
                (r"(痛い|つらい|しんどい)", 0.75),
                (r"(忙し|時間がな|余裕がな)", 0.7),
            ],
            "continuation": [
                (r"(続け|継続し)て(い|いま|きま)", 0.85),
                (r"(習慣|日課)に", 0.8),
                (r"毎日", 0.6),
            ],
            "situation_report": [
                (r"(変わり|改善し|良くなり)ました", 0.9),
                (r"(減り|増え|上がり|下がり)ました", 0.85),
                (r"(効果|結果)が", 0.7),
            ],
        }

        best_type = None
        best_confidence = 0.0

        for evidence_type, patterns in type_patterns.items():
            for pattern, confidence in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    if confidence > best_confidence:
                        best_confidence = confidence
                        best_type = evidence_type

        return best_type, best_confidence

    def get_evidence_types(self) -> list[dict]:
        """evidence_type の選択肢を返す"""
        return [
            {"value": d.label, "description": d.inclusion}
            for d in self.evidence_defs
            if d.kind == "type"
        ]

    def get_scope_options(self) -> list[dict]:
        """scope の選択肢を返す"""
        return [
            {"value": d.scope, "description": d.definition}
            for d in self.scope_defs
        ]

    def get_trigger_types(self) -> list[dict]:
        """trigger_type の選択肢を返す"""
        return [
            {
                "value": d.trigger_type,
                "priority": d.priority,
                "description": d.definition,
            }
            for d in self.trigger_defs
        ]

    def get_goal_domains(self) -> list[dict]:
        """goal_domain の選択肢を返す"""
        return [
            {"value": d.goal_domain, "description": d.definition}
            for d in self.goal_domain_defs
        ]
