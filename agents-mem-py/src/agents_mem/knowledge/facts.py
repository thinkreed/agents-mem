"""
事实提取模块 (Facts Extraction)

使用 LLM 从内容中提取原子事实。

事实类型:
- preference: 用户偏好
- decision: 决策或选择
- observation: 观察到的现象
- conclusion: 结论或推断

关键约束:
- 事实是原子性的，每个事实只表达一个信息
- 事实必须可追溯到原始内容
"""

import json
from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, Field

from agents_mem.core.types import FactType, Scope, EntityType


# ============================================================================
# ExtractedFact 数据模型
# ============================================================================


class ExtractedFact(BaseModel):
    """
    从内容中提取的原子事实

    由 FactExtractor.extract() 返回的原始事实结构。
    """

    content: str = Field(..., description="事实内容 (单句陈述)")
    fact_type: FactType = Field(..., description="事实类型")
    entities: list[str] = Field(default_factory=list, description="关联实体")
    confidence: float = Field(
        default=0.8,
        ge=0.0,
        le=1.0,
        description="置信度 (0.0-1.0)",
    )

    # 来源信息 (可选，由 KnowledgeLayer 填充)
    source_uri: str | None = Field(default=None, description="来源 URI")
    source_type: EntityType | None = Field(default=None, description="来源类型")
    source_id: str | None = Field(default=None, description="来源 ID")


# ============================================================================
# FactRecord 数据库记录模型
# ============================================================================


class FactRecord(BaseModel):
    """
    事实数据库记录

    对应 facts 表的完整记录结构。
    """

    id: str = Field(..., description="事实唯一标识")
    user_id: str = Field(..., description="用户 ID")
    agent_id: str | None = Field(default=None, description="代理 ID")
    team_id: str | None = Field(default=None, description="团队 ID")
    is_global: bool = Field(default=False, description="是否全局")

    # 来源信息
    source_type: str = Field(..., description="来源实体类型")
    source_id: str = Field(..., description="来源 ID")
    source_uri: str | None = Field(default=None, description="来源 URI")

    # 事实内容
    content: str = Field(..., description="事实内容")
    fact_type: str = Field(..., description="事实类型")
    entities: list[str] = Field(default_factory=list, description="关联实体")

    # 属性
    importance: float = Field(default=0.5, ge=0.0, le=1.0, description="重要性")
    confidence: float = Field(default=0.8, ge=0.0, le=1.0, description="置信度")
    verified: bool = Field(default=False, description="是否已验证")

    # 提取信息
    extraction_mode: str | None = Field(default=None, description="提取模式")
    extracted_at: datetime | None = Field(default=None, description="提取时间")

    # 时间戳
    created_at: datetime = Field(default_factory=datetime.now, description="创建时间")
    updated_at: datetime = Field(default_factory=datetime.now, description="更新时间")

    # OpenViking URI (可选)
    openviking_uri: str | None = Field(default=None, description="OpenViking URI")


# ============================================================================
# FactExtractor 类
# ============================================================================


# 事实提取系统提示词
FACT_SYSTEM_PROMPT = """You are a fact extraction assistant. Extract atomic facts from the given content.

For each fact, identify:
- content: The fact statement (one sentence)
- fact_type: One of: preference, decision, observation, conclusion
- entities: Entities involved (array of strings)
- confidence: Confidence level between 0.0 and 1.0

Output as a valid JSON array only (no markdown, no explanation).

Definitions:
- preference: User's likes, dislikes, or tendencies
- decision: Choices made or actions taken
- observation: Phenomena observed or noted
- conclusion: Inferences or conclusions drawn"""


class FactExtractor:
    """
    事实提取器

    使用 LLM 从内容中提取原子事实。

    特性:
    - 支持 LLM JSON 输出解析
    - 自动验证提取结果
    - 空内容优雅处理
    - 失败时返回空数组

    用法:
        extractor = FactExtractor(llm_client)
        facts = await extractor.extract(content)
    """

    # 有效事实类型列表
    VALID_FACT_TYPES = ["preference", "decision", "observation", "conclusion"]

    def __init__(self, llm_client: Any):
        """
        初始化事实提取器

        Args:
            llm_client: LLM 客户端 (支持 generate/generate_json 方法)
        """
        self._llm_client = llm_client

    async def extract(self, content: str) -> list[ExtractedFact]:
        """
        从内容中提取原子事实

        Args:
            content: 待提取的文本内容

        Returns:
            提取的事实列表 (失败时返回空列表)
        """
        # 处理空内容
        if not content or content.strip() == "":
            return []

        try:
            # 构建提示词
            prompt = self._build_prompt(content)

            # 调用 LLM 生成 JSON
            raw_facts = await self._call_llm(prompt)

            # 验证并过滤结果
            return self._validate_facts(raw_facts)

        except Exception:
            # 失败时返回空数组
            return []

    def _build_prompt(self, content: str) -> str:
        """构建事实提取提示词"""
        return f"""{FACT_SYSTEM_PROMPT}

Content:
{content}

Facts (JSON array):"""

    async def _call_llm(self, prompt: str) -> list[dict[str, Any]]:
        """调用 LLM 并返回 JSON 结果"""
        # 尝试使用 generate_json 方法
        if hasattr(self._llm_client, "generate_json"):
            result: list[dict[str, Any]] = await self._llm_client.generate_json(prompt, [])
            if isinstance(result, list):
                return result
            return []

        # 尝试使用 generate 方法并解析 JSON
        if hasattr(self._llm_client, "generate"):
            text = await self._llm_client.generate(prompt)
            return self._parse_json_from_text(text)

        # 尝试使用 ollama 客户端
        if hasattr(self._llm_client, "chat"):
            response = await self._llm_client.chat(
                messages=[{"role": "user", "content": prompt}],
                format="json",
            )
            content = response.get("message", {}).get("content", "[]")
            return self._parse_json_from_text(content)

        raise RuntimeError("LLM client does not support any generation method")

    def _parse_json_from_text(self, text: str) -> list[dict[str, Any]]:
        """从文本中解析 JSON 数组"""
        # 清理 markdown 包裹
        text = text.strip()
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        try:
            parsed: Any = json.loads(text.strip())
            if isinstance(parsed, list):
                return parsed
            return []
        except json.JSONDecodeError:
            return []

    def _validate_facts(
        self, raw_facts: list[dict[str, Any]]
    ) -> list[ExtractedFact]:
        """验证并过滤提取的事实"""
        valid_facts: list[ExtractedFact] = []

        for fact in raw_facts:
            if not isinstance(fact, dict):
                continue

            # 验证 content
            content = fact.get("content")
            if not isinstance(content, str) or not content.strip():
                continue

            # 验证 fact_type
            fact_type = fact.get("fact_type", "").lower()
            if fact_type not in self.VALID_FACT_TYPES:
                continue

            # 验证 entities
            entities = fact.get("entities", [])
            if not isinstance(entities, list):
                entities = []
            entities = [str(e) for e in entities if isinstance(e, (str, int, float))]

            # 验证 confidence
            confidence = fact.get("confidence", 0.8)
            if not isinstance(confidence, (int, float)):
                confidence = 0.8
            confidence = max(0.0, min(1.0, float(confidence)))

            valid_facts.append(
                ExtractedFact(
                    content=content.strip(),
                    fact_type=FactType(fact_type),
                    entities=entities,
                    confidence=confidence,
                )
            )

        return valid_facts

    async def extract_and_save(
        self,
        content: str,
        scope: Scope,
        source_type: EntityType,
        source_id: str,
        db_connection: Any,
    ) -> list[str]:
        """
        提取事实并保存到数据库

        Args:
            content: 待提取的文本内容
            scope: 作用域
            source_type: 来源类型
            source_id: 来源 ID
            db_connection: 数据库连接

        Returns:
            保存的事实 ID 列表
        """
        facts = await self.extract(content)
        fact_ids: list[str] = []

        for fact in facts:
            fact_id = str(uuid.uuid4())
            now = datetime.now()

            # 构建 URI
            agent = scope.agent_id or "_"
            team = scope.team_id or "_"
            source_uri = f"mem://{scope.user_id}/{agent}/{team}/{source_type.value}/{source_id}"

            # 插入数据库
            await db_connection.run(
                """INSERT INTO facts (
                    id, user_id, agent_id, team_id, is_global,
                    source_type, source_id, source_uri,
                    content, fact_type, entities,
                    importance, confidence, verified,
                    extraction_mode, extracted_at,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                [
                    fact_id,
                    scope.user_id,
                    scope.agent_id,
                    scope.team_id,
                    scope.is_global,
                    source_type.value,
                    source_id,
                    source_uri,
                    fact.content,
                    fact.fact_type.value,
                    json.dumps(fact.entities),
                    0.5,  # importance
                    fact.confidence,
                    False,  # verified
                    "on_demand",
                    now.timestamp(),
                    now.timestamp(),
                    now.timestamp(),
                ],
            )

            fact_ids.append(fact_id)

        return fact_ids


# ============================================================================
# 事实数据库操作辅助函数
# ============================================================================


async def get_fact_by_id(
    fact_id: str,
    db_connection: Any,
) -> FactRecord | None:
    """根据 ID 获取事实"""
    row = await db_connection.query_one(
        "SELECT * FROM facts WHERE id = ?",
        [fact_id],
    )

    if not row:
        return None

    return _row_to_fact_record(row)


async def get_facts_by_scope(
    scope: Scope,
    db_connection: Any,
) -> list[FactRecord]:
    """根据作用域获取事实列表"""
    sql = "SELECT * FROM facts WHERE user_id = ?"
    params: list[Any] = [scope.user_id]

    if scope.agent_id:
        sql += " AND agent_id = ?"
        params.append(scope.agent_id)

    if scope.team_id:
        sql += " AND team_id = ?"
        params.append(scope.team_id)

    sql += " ORDER BY importance DESC"

    rows = await db_connection.query(sql, params)
    return [_row_to_fact_record(row) for row in rows]


async def get_facts_by_source(
    source_type: str,
    source_id: str,
    db_connection: Any,
) -> list[FactRecord]:
    """根据来源获取事实列表"""
    rows = await db_connection.query(
        "SELECT * FROM facts WHERE source_type = ? AND source_id = ?",
        [source_type, source_id],
    )
    return [_row_to_fact_record(row) for row in rows]


async def search_facts(
    query: str,
    scope: Scope,
    db_connection: Any,
    fact_type: FactType | None = None,
    confidence_min: float | None = None,
) -> list[FactRecord]:
    """
    搜索事实

    Args:
        query: 搜索关键词
        scope: 作用域
        db_connection: 数据库连接
        fact_type: 过滤事实类型 (可选)
        confidence_min: 最低置信度 (可选)

    Returns:
        匹配的事实列表
    """
    sql = """SELECT * FROM facts WHERE user_id = ? AND content LIKE ?"""
    params: list[Any] = [scope.user_id, f"%{query}%"]

    if scope.agent_id:
        sql += " AND agent_id = ?"
        params.append(scope.agent_id)

    if scope.team_id:
        sql += " AND team_id = ?"
        params.append(scope.team_id)

    if fact_type:
        sql += " AND fact_type = ?"
        params.append(fact_type.value)

    if confidence_min:
        sql += " AND confidence >= ?"
        params.append(confidence_min)

    sql += " ORDER BY confidence DESC, importance DESC"

    rows = await db_connection.query(sql, params)
    return [_row_to_fact_record(row) for row in rows]


async def delete_fact(
    fact_id: str,
    db_connection: Any,
) -> bool:
    """删除事实"""
    cursor = await db_connection.run(
        "DELETE FROM facts WHERE id = ?",
        [fact_id],
    )
    return cursor.rowcount > 0


def _row_to_fact_record(row: dict[str, Any]) -> FactRecord:
    """将数据库行转换为 FactRecord"""
    entities_raw = row.get("entities", "[]")
    entities: list[str]
    if isinstance(entities_raw, str):
        parsed: Any = json.loads(entities_raw)
        entities = parsed if isinstance(parsed, list) else []
    else:
        entities = list(entities_raw) if entities_raw else []

    # 处理时间戳
    created_at_ts = row.get("created_at")
    if isinstance(created_at_ts, (int, float)):
        created_at = datetime.fromtimestamp(created_at_ts)
    elif isinstance(created_at_ts, datetime):
        created_at = created_at_ts
    else:
        created_at = datetime.now()

    updated_at_ts = row.get("updated_at")
    if isinstance(updated_at_ts, (int, float)):
        updated_at = datetime.fromtimestamp(updated_at_ts)
    elif isinstance(updated_at_ts, datetime):
        updated_at = updated_at_ts
    else:
        updated_at = datetime.now()

    extracted_at_ts = row.get("extracted_at")
    extracted_at: datetime | None = None
    if extracted_at_ts is not None:
        if isinstance(extracted_at_ts, (int, float)):
            extracted_at = datetime.fromtimestamp(extracted_at_ts)
        elif isinstance(extracted_at_ts, datetime):
            extracted_at = extracted_at_ts

    return FactRecord(
        id=row["id"],
        user_id=row["user_id"],
        agent_id=row.get("agent_id"),
        team_id=row.get("team_id"),
        is_global=bool(row.get("is_global", False)),
        source_type=row["source_type"],
        source_id=row["source_id"],
        source_uri=row.get("source_uri"),
        content=row["content"],
        fact_type=row["fact_type"],
        entities=entities,
        importance=row.get("importance", 0.5),
        confidence=row.get("confidence", 0.8),
        verified=bool(row.get("verified", False)),
        extraction_mode=row.get("extraction_mode"),
        extracted_at=extracted_at,
        created_at=created_at,
        updated_at=updated_at,
        openviking_uri=row.get("openviking_uri"),
    )


__all__ = [
    "ExtractedFact",
    "FactRecord",
    "FactExtractor",
    "get_fact_by_id",
    "get_facts_by_scope",
    "get_facts_by_source",
    "search_facts",
    "delete_fact",
    "FACT_SYSTEM_PROMPT",
]