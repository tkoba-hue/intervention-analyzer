"""
処理APIルーター: 各ステップの処理を実行
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import re
import html

router = APIRouter()


class TextRecord(BaseModel):
    id: str
    datetime: str
    speaker: str  # 'participant' or 'other'
    text_raw: str


class NormalizeRequest(BaseModel):
    records: list[TextRecord]


class NormalizeResponse(BaseModel):
    records: list[dict]
    processed_count: int


class AnchorExtractRequest(BaseModel):
    records: list[dict]


class AnchorExtractResponse(BaseModel):
    records: list[dict]
    anchor_count: int
    total_participant_count: int


class TriggerClassifyRequest(BaseModel):
    records: list[dict]


class TriggerClassifyResponse(BaseModel):
    records: list[dict]


@router.post("/normalize", response_model=NormalizeResponse)
async def normalize_text(request: NormalizeRequest):
    """Step 1: テキスト正規化"""
    results = []

    for record in request.records:
        text = record.text_raw

        # HTML タグ除去
        text = re.sub(r"<[^>]+>", "", text)

        # 連続空白を単一スペースに
        text = re.sub(r"\s+", " ", text)

        # 前後の空白を除去
        text = text.strip()

        # HTML エンティティをデコード
        text = html.unescape(text)

        results.append({
            "id": record.id,
            "datetime": record.datetime,
            "speaker": record.speaker,
            "text_raw": record.text_raw,
            "text_norm": text,
        })

    return NormalizeResponse(
        records=results,
        processed_count=len(results),
    )


@router.post("/exclude-mark")
async def mark_exclusions(request: dict):
    """Step 2: 除外マーク付与"""
    records = request.get("records", [])
    results = []

    for record in records:
        text = record.get("text_norm") or record.get("text_raw", "")

        # 除外判定
        exclude_flag = False
        exclude_reason = None

        # スタンプのみ
        if re.match(r"^[\U0001F600-\U0001F64F\U0001F300-\U0001F5FF\U0001F680-\U0001F6FF\s]+$", text):
            exclude_flag = True
            exclude_reason = "スタンプのみ"

        # 短すぎる（5文字未満）
        elif len(text) < 5:
            exclude_flag = True
            exclude_reason = "短文"

        # 写真送信のみ
        elif re.match(r"^(写真|画像|ファイル)を?(送信|送り)?(しました)?$", text):
            exclude_flag = True
            exclude_reason = "メディア送信のみ"

        results.append({
            **record,
            "exclude_flag": exclude_flag,
            "exclude_reason": exclude_reason,
        })

    excluded_count = sum(1 for r in results if r["exclude_flag"])

    return {
        "records": results,
        "excluded_count": excluded_count,
        "total_count": len(results),
    }


@router.post("/extract-anchors", response_model=AnchorExtractResponse)
async def extract_anchors(request: AnchorExtractRequest):
    """Step 3: evidence anchor 候補抽出"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    # ルールエンジンを初期化
    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    results = []
    anchor_count = 0
    participant_count = 0

    for record in request.records:
        result = dict(record)

        # 参加者の発話のみ対象
        if record.get("speaker") == "participant" and not record.get("exclude_flag"):
            participant_count += 1
            text = record.get("text_norm") or record.get("text_raw", "")
            is_anchor, confidence, matched_patterns = rule_engine.extract_evidence_anchor(text)

            result["evidence_anchor"] = 1 if is_anchor else 0
            result["evidence_anchor_confidence"] = confidence
            result["evidence_anchor_patterns"] = matched_patterns

            if is_anchor:
                anchor_count += 1
        else:
            result["evidence_anchor"] = 0
            result["evidence_anchor_confidence"] = 0
            result["evidence_anchor_patterns"] = []

        results.append(result)

    return AnchorExtractResponse(
        records=results,
        anchor_count=anchor_count,
        total_participant_count=participant_count,
    )


@router.post("/classify-triggers", response_model=TriggerClassifyResponse)
async def classify_triggers(request: TriggerClassifyRequest):
    """Step 8: trigger 分類"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    results = []

    for record in request.records:
        result = dict(record)

        # other の発話のみ対象
        if record.get("speaker") == "other" and not record.get("exclude_flag"):
            text = record.get("text_norm") or record.get("text_raw", "")
            triggers = rule_engine.classify_trigger(text)
            triggers = rule_engine.apply_priority_rules(triggers)

            result["trigger_type_auto"] = [t for t, _, _ in triggers]
            result["trigger_type_final"] = [t for t, _, _ in triggers]
            # 最大確信度を取得
            result["trigger_type_confidence"] = max((c for _, _, c in triggers), default=0)
        else:
            result["trigger_type_auto"] = []
            result["trigger_type_final"] = []
            result["trigger_type_confidence"] = 0

        results.append(result)

    return TriggerClassifyResponse(records=results)


@router.post("/classify-evidence-type")
async def classify_evidence_type(request: dict):
    """Step 6: evidence_type 分類"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    records = request.get("records", [])
    results = []

    for record in records:
        result = dict(record)

        if record.get("evidence_flag_strict"):
            text = record.get("text_norm") or record.get("text_raw", "")
            evidence_type, confidence = rule_engine.classify_evidence_type(text)

            result["evidence_type_auto"] = evidence_type
            result["evidence_type_confidence"] = confidence
            if evidence_type:
                result["evidence_type_final"] = evidence_type

        results.append(result)

    return {"records": results}


@router.post("/classify-scope")
async def classify_scope(request: dict):
    """Step 7: scope 分類"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    records = request.get("records", [])
    results = []

    for record in records:
        result = dict(record)

        if record.get("evidence_flag_strict"):
            text = record.get("text_norm") or record.get("text_raw", "")
            evidence_type = record.get("evidence_type_final")
            scope = rule_engine.classify_scope(text, evidence_type)

            result["scope_auto"] = scope
            result["scope_final"] = scope

        results.append(result)

    return {"records": results}


@router.post("/classify-goal-domain")
async def classify_goal_domain(request: dict):
    """Step 10: goal_domain 分類"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    records = request.get("records", [])
    results = []

    for record in records:
        result = dict(record)

        if record.get("scope_final") == "goal_related":
            text = record.get("text_norm") or record.get("text_raw", "")
            domain = rule_engine.classify_goal_domain(text)

            result["goal_domain_auto"] = domain
            result["goal_domain_final"] = domain

        results.append(result)

    return {"records": results}


@router.get("/definitions")
async def get_definitions():
    """定義ファイルの内容を返す"""
    from rules.rule_engine import RuleEngine
    from pathlib import Path

    definitions_dir = Path(__file__).parent.parent / "definitions"
    rule_engine = RuleEngine(definitions_dir)

    return {
        "evidence_types": rule_engine.get_evidence_types(),
        "scope_options": rule_engine.get_scope_options(),
        "trigger_types": rule_engine.get_trigger_types(),
        "goal_domains": rule_engine.get_goal_domains(),
    }
