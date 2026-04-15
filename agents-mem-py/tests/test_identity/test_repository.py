"""
Tests for identity.repository module.

Tests User, Agent, Team, TeamMember models and repository classes.
"""

import pytest
import pytest_asyncio
import time

from agents_mem.core.types import Scope
from agents_mem.identity.layer import IdentityLayer
from agents_mem.identity.repository import (
    User,
    Agent,
    Team,
    TeamMember,
    UserRepository,
    AgentRepository,
    TeamRepository,
    TeamMemberRepository,
)
from agents_mem.core.exceptions import NotFoundError, ScopeError


# ============================================================================
# Model Tests
# ============================================================================


class TestUser:
    """User model tests."""

    def test_user_creation(self):
        """Test User creation."""
        now = int(time.time())
        user = User(
            id="user-001",
            name="Test User",
            email="test@example.com",
            created_at=now,
            updated_at=now,
        )
        assert user.id == "user-001"
        assert user.name == "Test User"
        assert user.email == "test@example.com"
        assert user.is_active is True

    def test_user_with_metadata(self):
        """Test User with metadata."""
        now = int(time.time())
        user = User(
            id="user-001",
            name="Test User",
            created_at=now,
            updated_at=now,
            metadata={"role": "admin", "department": "IT"},
        )
        assert user.metadata["role"] == "admin"

    def test_user_frozen(self):
        """Test User is frozen."""
        now = int(time.time())
        user = User(id="user-001", name="Test", created_at=now, updated_at=now)
        with pytest.raises(Exception):
            user.name = "New Name"


class TestAgent:
    """Agent model tests."""

    def test_agent_creation(self):
        """Test Agent creation."""
        now = int(time.time())
        agent = Agent(
            id="agent-001",
            user_id="user-001",
            name="Test Agent",
            created_at=now,
            updated_at=now,
        )
        assert agent.id == "agent-001"
        assert agent.user_id == "user-001"
        assert agent.name == "Test Agent"
        assert agent.is_active is True

    def test_agent_with_description(self):
        """Test Agent with description."""
        now = int(time.time())
        agent = Agent(
            id="agent-001",
            user_id="user-001",
            name="Test Agent",
            description="A test agent for testing",
            created_at=now,
            updated_at=now,
        )
        assert agent.description == "A test agent for testing"


class TestTeam:
    """Team model tests."""

    def test_team_creation(self):
        """Test Team creation."""
        now = int(time.time())
        team = Team(
            id="team-001",
            user_id="user-001",
            name="Test Team",
            created_at=now,
            updated_at=now,
        )
        assert team.id == "team-001"
        assert team.user_id == "user-001"
        assert team.name == "Test Team"
        assert team.is_active is True

    def test_team_with_description(self):
        """Test Team with description."""
        now = int(time.time())
        team = Team(
            id="team-001",
            user_id="user-001",
            name="Test Team",
            description="A test team",
            created_at=now,
            updated_at=now,
        )
        assert team.description == "A test team"


class TestTeamMember:
    """TeamMember model tests."""

    def test_team_member_creation(self):
        """Test TeamMember creation."""
        now = int(time.time())
        member = TeamMember(
            id="team-001_agent-001",
            team_id="team-001",
            agent_id="agent-001",
            user_id="user-001",
            role="member",
            joined_at=now,
        )
        assert member.id == "team-001_agent-001"
        assert member.team_id == "team-001"
        assert member.agent_id == "agent-001"
        assert member.role == "member"

    def test_team_member_roles(self):
        """Test TeamMember different roles."""
        now = int(time.time())
        admin = TeamMember(
            id="team-001_agent-001",
            team_id="team-001",
            agent_id="agent-001",
            user_id="user-001",
            role="admin",
            joined_at=now,
        )
        assert admin.role == "admin"


# ============================================================================
# Repository Tests with Mock DB
# ============================================================================


class MockDBForRepository:
    """Mock database for repository tests."""

    def __init__(self):
        self._tables = {
            "users": {},
            "agents": {},
            "teams": {},
            "team_members": {},
        }
        self._last_insert_id = None

    async def execute(self, sql, params=None):
        """Execute SQL."""
        params = params or {}
        return self

    async def fetch_one(self, sql, params=None):
        """Fetch single row."""
        params = params or {}
        
        # Parse table from SQL
        sql_lower = sql.lower()
        
        if "users" in sql_lower:
            id_val = params.get("id")
            if id_val and id_val in self._tables["users"]:
                return self._tables["users"][id_val]
        
        if "agents" in sql_lower:
            id_val = params.get("id")
            user_id = params.get("user_id")
            if id_val and id_val in self._tables["agents"]:
                return self._tables["agents"][id_val]
        
        if "teams" in sql_lower:
            id_val = params.get("id")
            if id_val and id_val in self._tables["teams"]:
                return self._tables["teams"][id_val]
        
        if "team_members" in sql_lower:
            id_val = params.get("id")
            if id_val and id_val in self._tables["team_members"]:
                return self._tables["team_members"][id_val]
        
        return None

    async def fetch_all(self, sql, params=None):
        """Fetch all rows."""
        params = params or {}
        sql_lower = sql.lower()
        
        if "users" in sql_lower:
            return list(self._tables["users"].values())
        
        if "agents" in sql_lower:
            user_id = params.get("user_id")
            if user_id:
                return [
                    a for a in self._tables["agents"].values()
                    if a.get("user_id") == user_id
                ]
            return list(self._tables["agents"].values())
        
        if "teams" in sql_lower:
            user_id = params.get("user_id")
            if user_id:
                return [
                    t for t in self._tables["teams"].values()
                    if t.get("user_id") == user_id
                ]
            return list(self._tables["teams"].values())
        
        if "team_members" in sql_lower:
            team_id = params.get("team_id")
            if team_id:
                return [
                    m for m in self._tables["team_members"].values()
                    if m.get("team_id") == team_id
                ]
            return list(self._tables["team_members"].values())
        
        return []

    def _insert_user(self, user_data):
        """Insert user."""
        self._tables["users"][user_data["id"]] = user_data

    def _insert_agent(self, agent_data):
        """Insert agent."""
        self._tables["agents"][agent_data["id"]] = agent_data

    def _insert_team(self, team_data):
        """Insert team."""
        self._tables["teams"][team_data["id"]] = team_data

    def _insert_team_member(self, member_data):
        """Insert team member."""
        self._tables["team_members"][member_data["id"]] = member_data


@pytest_asyncio.fixture
async def mock_repo_db():
    """Create mock database for repository tests."""
    return MockDBForRepository()


class TestUserRepository:
    """UserRepository tests."""

    @pytest.mark.asyncio
    async def test_create_user(self, mock_repo_db):
        """Test create user."""
        identity = IdentityLayer()
        repo = UserRepository(mock_repo_db, identity)
        
        user = await repo.create(
            id="user-001",
            name="Test User",
            email="test@example.com",
        )
        
        assert user.id == "user-001"
        assert user.name == "Test User"
        assert user.email == "test@example.com"

    @pytest.mark.asyncio
    async def test_create_user_with_metadata(self, mock_repo_db):
        """Test create user with metadata."""
        identity = IdentityLayer()
        repo = UserRepository(mock_repo_db, identity)
        
        user = await repo.create(
            id="user-001",
            name="Test User",
            metadata={"key": "value"},
        )
        
        assert user.metadata == {"key": "value"}


class TestAgentRepository:
    """AgentRepository tests."""

    @pytest.mark.asyncio
    async def test_create_agent(self, mock_repo_db):
        """Test create agent."""
        identity = IdentityLayer()
        repo = AgentRepository(mock_repo_db, identity)
        scope = Scope(user_id="user-001")
        
        agent = await repo.create(
            scope=scope,
            id="agent-001",
            name="Test Agent",
        )
        
        assert agent.id == "agent-001"
        assert agent.user_id == "user-001"

    @pytest.mark.asyncio
    async def test_create_agent_validates_scope(self, mock_repo_db):
        """Test create agent validates scope."""
        identity = IdentityLayer()
        repo = AgentRepository(mock_repo_db, identity)
        
        # Invalid scope (empty user_id)
        with pytest.raises(ScopeError):
            await repo.create(
                scope=Scope(user_id=""),
                id="agent-001",
                name="Test",
            )


class TestTeamRepository:
    """TeamRepository tests."""

    @pytest.mark.asyncio
    async def test_create_team(self, mock_repo_db):
        """Test create team."""
        identity = IdentityLayer()
        repo = TeamRepository(mock_repo_db, identity)
        scope = Scope(user_id="user-001")
        
        team = await repo.create(
            scope=scope,
            id="team-001",
            name="Test Team",
        )
        
        assert team.id == "team-001"
        assert team.user_id == "user-001"


class TestTeamMemberRepository:
    """TeamMemberRepository tests."""

    @pytest.mark.asyncio
    async def test_create_team_member(self, mock_repo_db):
        """Test create team member."""
        identity = IdentityLayer()
        repo = TeamMemberRepository(mock_repo_db, identity)
        scope = Scope(user_id="user-001")
        
        member = await repo.create(
            scope=scope,
            team_id="team-001",
            agent_id="agent-001",
            role="member",
        )
        
        assert member.team_id == "team-001"
        assert member.agent_id == "agent-001"
        assert member.role == "member"