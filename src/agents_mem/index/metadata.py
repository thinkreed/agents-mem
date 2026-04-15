"""
L1 Metadata Index Module

Implements metadata indexing with full-text search (FTS) capabilities.
Uses SQLite LIKE queries for text matching (FTS5 would require separate virtual table).

Table: memory_index
Fields: uri, user_id, agent_id, team_id, is_global, target_type, target_id,
        title, description, topic, entity, category, tags, importance, path
"""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol

from pydantic import BaseModel, ConfigDict, Field

from agents_mem.core.types import Scope, SearchResult
from agents_mem.core.exceptions import SearchError, NotFoundError
from agents_mem.identity.layer import IdentityLayer


# ============================================================================
# Database Connection Protocol
# ============================================================================


class DBConnection(Protocol):
    """Database connection protocol for metadata operations"""

    async def execute(
        self, query: str, params: dict[str, Any] | None = None
    ) -> Any: ...

    async def fetch_one(
        self, query: str, params: dict[str, Any] | None = None
    ) -> dict[str, Any] | None: ...

    async def fetch_all(
        self, query: str, params: dict[str, Any] | None = None
    ) -> list[dict[str, Any]]: ...


# ============================================================================
# Metadata Entry Model
# ============================================================================


class MetadataEntry(BaseModel):
    """
    Metadata entry model

    Represents an indexed resource entry in memory_index table.
    """

    model_config = ConfigDict(frozen=True)

    uri: str = Field(..., description="mem:// URI for the resource")
    user_id: str = Field(..., description="User ID")
    agent_id: str | None = Field(default=None, description="Agent ID")
    team_id: str | None = Field(default=None, description="Team ID")
    is_global: bool = Field(default=False, description="Global visibility")
    target_type: str = Field(..., description="Resource type (documents, assets, etc.)")
    target_id: str = Field(..., description="Resource ID")
    title: str = Field(..., description="Resource title")
    description: str | None = Field(default=None, description="Resource description")
    topic: str | None = Field(default=None, description="Topic/category")
    entity: str | None = Field(default=None, description="Associated entity")
    category: str | None = Field(default=None, description="Category classification")
    tags: str | None = Field(default=None, description="Comma-separated tags")
    importance: float = Field(default=0.5, description="Importance score (0-1)")
    path: str | None = Field(default=None, description="Hierarchical path")
    created_at: int = Field(..., description="Created timestamp (Unix seconds)")
    updated_at: int = Field(..., description="Updated timestamp (Unix seconds)")

    def to_search_result(self) -> SearchResult:
        """Convert to SearchResult"""
        return SearchResult(
            uri=self.uri,
            score=self.importance,
            title=self.title,
            content=self.description,
            metadata={
                "target_type": self.target_type,
                "target_id": self.target_id,
                "topic": self.topic,
                "entity": self.entity,
                "category": self.category,
                "tags": self.tags,
                "path": self.path,
            },
        )


# ============================================================================
# Search Options
# ============================================================================


@dataclass
class SearchOptions:
    """Search options for metadata search"""

    limit: int = 10
    offset: int = 0
    min_importance: float = 0.0
    target_type: str | None = None
    order_by: str = "importance DESC"


# ============================================================================
# Metadata Index Class
# ============================================================================


class MetadataIndex:
    """
    Metadata Index for L1 Index Layer

    Provides full-text search (FTS) using SQLite LIKE queries and
    scope-based filtering for resource metadata.

    Features:
    - Text search across title, description, topic, entity, category
    - Scope filtering (user_id, agent_id, team_id)
    - Importance-based ranking
    - Type-based filtering
    """

    TABLE_NAME = "memory_index"

    # Searchable columns for FTS
    SEARCH_COLUMNS = ["title", "description", "topic", "entity", "category"]

    def __init__(
        self,
        db: DBConnection,
        identity_layer: IdentityLayer,
    ):
        """
        Initialize MetadataIndex

        Args:
            db: Database connection
            identity_layer: L0 IdentityLayer for scope validation
        """
        self._db = db
        self._identity = identity_layer

    def _get_timestamp(self) -> int:
        """Get current Unix timestamp"""
        return int(datetime.now().timestamp())

    # =========================================================================
    # Core Search Methods
    # =========================================================================

    async def search(
        self,
        query: str,
        scope: Scope,
        options: SearchOptions | None = None,
    ) -> list[SearchResult]:
        """
        Full-text search (FTS) for metadata

        Uses LIKE queries for text matching across searchable columns.
        SQLite FTS5 would require a separate virtual table.

        Args:
            query: Search query text
            scope: Scope for filtering
            options: Search options (limit, offset, etc.)

        Returns:
            List of SearchResult objects

        Raises:
            SearchError: Search operation failed
        """
        # Validate scope
        self._identity.validate_scope_or_raise(scope)

        options = options or SearchOptions()

        # Build WHERE clause for scope filtering
        scope_conditions = self._build_scope_conditions(scope)

        # Build text search conditions
        text_conditions = self._build_text_search_conditions(query)

        # Combine conditions
        conditions: list[str] = []
        params: dict[str, Any] = {}

        if scope_conditions:
            conditions.extend(scope_conditions["conditions"])
            params.update(scope_conditions["params"])

        if text_conditions:
            conditions.extend(text_conditions["conditions"])
            params.update(text_conditions["params"])

        # Add type filter
        if options.target_type:
            conditions.append("target_type = :target_type")
            params["target_type"] = options.target_type

        # Add importance filter
        if options.min_importance > 0:
            conditions.append("importance >= :min_importance")
            params["min_importance"] = options.min_importance

        # Build SQL
        where_clause = " AND ".join(conditions) if conditions else "1=1"
        order_clause = f"ORDER BY {options.order_by}"
        limit_clause = f"LIMIT {options.limit} OFFSET {options.offset}"

        sql = f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE {where_clause}
            {order_clause}
            {limit_clause}
        """

        try:
            rows = await self._db.fetch_all(sql, params)
            return [self._row_to_search_result(row) for row in rows]
        except Exception as e:
            raise SearchError(
                message=f"Metadata search failed: {e}",
                query=query,
                search_mode="fts",
            )

    async def filter_by_scope(
        self,
        scope: Scope,
        target_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[MetadataEntry]:
        """
        Filter entries by scope

        Args:
            scope: Scope for filtering
            target_type: Optional type filter
            limit: Result limit
            offset: Result offset

        Returns:
            List of MetadataEntry objects
        """
        self._identity.validate_scope_or_raise(scope)

        conditions = ["user_id = :user_id"]
        params: dict[str, Any] = {"user_id": scope.user_id}

        if scope.agent_id:
            conditions.append("(agent_id = :agent_id OR agent_id IS NULL)")
            params["agent_id"] = scope.agent_id

        if scope.team_id:
            conditions.append("(team_id = :team_id OR team_id IS NULL)")
            params["team_id"] = scope.team_id

        if target_type:
            conditions.append("target_type = :target_type")
            params["target_type"] = target_type

        where_clause = " AND ".join(conditions)

        sql = f"""
            SELECT * FROM {self.TABLE_NAME}
            WHERE {where_clause}
            ORDER BY importance DESC, updated_at DESC
            LIMIT :limit OFFSET :offset
        """

        params["limit"] = limit
        params["offset"] = offset

        rows = await self._db.fetch_all(sql, params)
        return [self._row_to_entry(row) for row in rows]

    # =========================================================================
    # CRUD Operations
    # =========================================================================

    async def index_resource(
        self,
        uri: str,
        scope: Scope,
        target_type: str,
        target_id: str,
        title: str,
        description: str | None = None,
        topic: str | None = None,
        entity: str | None = None,
        category: str | None = None,
        tags: list[str] | None = None,
        importance: float = 0.5,
        path: str | None = None,
        is_global: bool = False,
    ) -> MetadataEntry:
        """
        Index a resource in metadata

        Args:
            uri: mem:// URI for the resource
            scope: Scope for the resource
            target_type: Resource type
            target_id: Resource ID
            title: Resource title
            description: Optional description
            topic: Optional topic
            entity: Optional entity
            category: Optional category
            tags: Optional tags list
            importance: Importance score (0-1)
            path: Optional hierarchical path
            is_global: Global visibility flag

        Returns:
            Created MetadataEntry

        Raises:
            ScopeError: Scope validation failed
        """
        self._identity.validate_scope_or_raise(scope)

        now = self._get_timestamp()
        tags_str = ",".join(tags) if tags else None

        await self._db.execute(
            f"""
            INSERT OR REPLACE INTO {self.TABLE_NAME} (
                uri, user_id, agent_id, team_id, is_global,
                target_type, target_id, title, description,
                topic, entity, category, tags, importance, path,
                created_at, updated_at
            ) VALUES (
                :uri, :user_id, :agent_id, :team_id, :is_global,
                :target_type, :target_id, :title, :description,
                :topic, :entity, :category, :tags, :importance, :path,
                :created_at, :updated_at
            )
            """,
            {
                "uri": uri,
                "user_id": scope.user_id,
                "agent_id": scope.agent_id,
                "team_id": scope.team_id,
                "is_global": is_global,
                "target_type": target_type,
                "target_id": target_id,
                "title": title,
                "description": description,
                "topic": topic,
                "entity": entity,
                "category": category,
                "tags": tags_str,
                "importance": importance,
                "path": path,
                "created_at": now,
                "updated_at": now,
            },
        )

        return MetadataEntry(
            uri=uri,
            user_id=scope.user_id,
            agent_id=scope.agent_id,
            team_id=scope.team_id,
            is_global=is_global,
            target_type=target_type,
            target_id=target_id,
            title=title,
            description=description,
            topic=topic,
            entity=entity,
            category=category,
            tags=tags_str,
            importance=importance,
            path=path,
            created_at=now,
            updated_at=now,
        )

    async def get_by_uri(self, uri: str) -> MetadataEntry | None:
        """
        Get metadata entry by URI

        Args:
            uri: mem:// URI

        Returns:
            MetadataEntry or None if not found
        """
        row = await self._db.fetch_one(
            f"SELECT * FROM {self.TABLE_NAME} WHERE uri = :uri",
            {"uri": uri},
        )
        return self._row_to_entry(row) if row else None

    async def get_by_uri_or_raise(self, uri: str) -> MetadataEntry:
        """
        Get metadata entry by URI or raise exception

        Args:
            uri: mem:// URI

        Returns:
            MetadataEntry

        Raises:
            NotFoundError: Entry not found
        """
        entry = await self.get_by_uri(uri)
        if not entry:
            raise NotFoundError(
                message=f"Metadata entry not found: {uri}",
                resource_type="metadata",
                resource_id=uri,
            )
        return entry

    async def update(
        self,
        uri: str,
        title: str | None = None,
        description: str | None = None,
        topic: str | None = None,
        entity: str | None = None,
        category: str | None = None,
        tags: list[str] | None = None,
        importance: float | None = None,
        path: str | None = None,
    ) -> MetadataEntry:
        """
        Update metadata entry

        Args:
            uri: mem:// URI
            title: New title
            description: New description
            topic: New topic
            entity: New entity
            category: New category
            tags: New tags list
            importance: New importance
            path: New path

        Returns:
            Updated MetadataEntry

        Raises:
            NotFoundError: Entry not found
        """
        entry = await self.get_by_uri_or_raise(uri)
        now = self._get_timestamp()

        updates: dict[str, Any] = {"updated_at": now}
        if title is not None:
            updates["title"] = title
        if description is not None:
            updates["description"] = description
        if topic is not None:
            updates["topic"] = topic
        if entity is not None:
            updates["entity"] = entity
        if category is not None:
            updates["category"] = category
        if tags is not None:
            updates["tags"] = ",".join(tags)
        if importance is not None:
            updates["importance"] = importance
        if path is not None:
            updates["path"] = path

        set_clause = ", ".join(f"{k} = :{k}" for k in updates.keys())
        await self._db.execute(
            f"UPDATE {self.TABLE_NAME} SET {set_clause} WHERE uri = :uri",
            {"uri": uri, **updates},
        )

        return MetadataEntry(
            uri=uri,
            user_id=entry.user_id,
            agent_id=entry.agent_id,
            team_id=entry.team_id,
            is_global=entry.is_global,
            target_type=entry.target_type,
            target_id=entry.target_id,
            title=updates.get("title", entry.title),
            description=updates.get("description", entry.description),
            topic=updates.get("topic", entry.topic),
            entity=updates.get("entity", entry.entity),
            category=updates.get("category", entry.category),
            tags=updates.get("tags", entry.tags),
            importance=updates.get("importance", entry.importance),
            path=updates.get("path", entry.path),
            created_at=entry.created_at,
            updated_at=now,
        )

    async def delete(self, uri: str) -> bool:
        """
        Delete metadata entry

        Args:
            uri: mem:// URI

        Returns:
            True if deleted, False if not found
        """
        result = await self._db.execute(
            f"DELETE FROM {self.TABLE_NAME} WHERE uri = :uri",
            {"uri": uri},
        )
        return result > 0

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _build_scope_conditions(
        self, scope: Scope
    ) -> dict[str, Any]:
        """Build WHERE conditions for scope filtering"""
        conditions: list[str] = ["user_id = :user_id"]
        params: dict[str, Any] = {"user_id": scope.user_id}

        # agent_id: match exact or NULL (for user-level resources)
        if scope.agent_id:
            conditions.append("(agent_id = :agent_id OR agent_id IS NULL)")
            params["agent_id"] = scope.agent_id

        # team_id: match exact or NULL (for non-team resources)
        if scope.team_id:
            conditions.append("(team_id = :team_id OR team_id IS NULL)")
            params["team_id"] = scope.team_id

        return {"conditions": conditions, "params": params}

    def _build_text_search_conditions(
        self, query: str
    ) -> dict[str, Any] | None:
        """Build WHERE conditions for text search using LIKE"""
        if not query:
            return None

        # Escape special LIKE characters
        escaped_query = query.replace("%", "\\%").replace("_", "\\_")

        # Search pattern (match anywhere)
        pattern = f"%{escaped_query}%"

        # Build OR conditions for each searchable column
        conditions: list[str] = []
        params: dict[str, Any] = {}

        for i, col in enumerate(self.SEARCH_COLUMNS):
            param_name = f"query_{i}"
            conditions.append(f"{col} LIKE :{param_name} ESCAPE '\\'")
            params[param_name] = pattern

        # Combine with OR
        or_condition = " OR ".join(conditions)

        return {"conditions": [f"({or_condition})"], "params": params}

    def _row_to_entry(self, row: dict[str, Any]) -> MetadataEntry:
        """Convert database row to MetadataEntry"""
        return MetadataEntry(
            uri=row.get("uri", ""),
            user_id=row.get("user_id", ""),
            agent_id=row.get("agent_id"),
            team_id=row.get("team_id"),
            is_global=row.get("is_global", False),
            target_type=row.get("target_type", ""),
            target_id=row.get("target_id", ""),
            title=row.get("title", ""),
            description=row.get("description"),
            topic=row.get("topic"),
            entity=row.get("entity"),
            category=row.get("category"),
            tags=row.get("tags"),
            importance=row.get("importance", 0.5),
            path=row.get("path"),
            created_at=row.get("created_at", 0),
            updated_at=row.get("updated_at", 0),
        )

    def _row_to_search_result(self, row: dict[str, Any]) -> SearchResult:
        """Convert database row to SearchResult"""
        entry = self._row_to_entry(row)
        return entry.to_search_result()


__all__ = [
    "MetadataEntry",
    "MetadataIndex",
    "SearchOptions",
    "DBConnection",
]