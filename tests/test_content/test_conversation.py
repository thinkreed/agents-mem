"""
Tests for content.resources.conversation module.

Tests ConversationRepository, MessageRepository, Conversation, Message.
"""

import pytest
import pytest_asyncio
from typing import Any, Protocol

from agents_mem.core.types import Scope
from agents_mem.content.resources.conversation import (
    Conversation,
    Message,
    ConversationCreateInput,
    MessageCreateInput,
    ConversationRepository,
    MessageRepository,
)
from agents_mem.content.capabilities.tiered import TieredViewCapability
from agents_mem.llm import MockLLMClient


class MockDBConnection:
    """Mock database"""
    
    def __init__(self):
        self._conversations: dict[str, dict] = {}
        self._messages: dict[str, list] = {}
    
    async def run(self, sql: str, params: list | None = None):
        if "INSERT INTO conversations" in sql:
            conv_id = params[0] if params else ""
            self._conversations[conv_id] = {
                "id": conv_id,
                "user_id": params[1] if len(params) > 1 else "",
                "agent_id": params[2] if len(params) > 2 else "",
                "title": params[3] if len(params) > 3 else "",
            }
            self._messages[conv_id] = []
        if "INSERT INTO messages" in sql:
            conv_id = params[1] if len(params) > 1 else ""
            msg = {
                "id": params[0],
                "conversation_id": conv_id,
                "role": params[2],
                "content": params[3],
            }
            if conv_id in self._messages:
                self._messages[conv_id].append(msg)
        return None
    
    async def query(self, sql: str, params: list | None = None):
        if "messages" in sql:
            conv_id = params[0] if params else ""
            return self._messages.get(conv_id, [])
        return list(self._conversations.values())
    
    async def query_one(self, sql: str, params: list | None = None):
        if "conversations" in sql and ("WHERE id =" in sql or "WHERE id=" in sql):
            conv_id = params[0] if params else ""
            return self._conversations.get(conv_id)
        return None


@pytest.fixture
def mock_db():
    return MockDBConnection()


@pytest.fixture
def tiered():
    return TieredViewCapability(MockLLMClient())


@pytest.fixture
def msg_repo(mock_db):
    return MessageRepository(mock_db)


@pytest.fixture
def conv_repo(mock_db, msg_repo, tiered):
    return ConversationRepository(mock_db, msg_repo, tiered)


@pytest.fixture
def sample_scope():
    return Scope(user_id="user123", agent_id="agent1")


class TestConversation:
    """Conversation model tests"""
    
    def test_conversation_creation(self):
        """Test creating conversation"""
        conv = Conversation(
            id="conv-001",
            user_id="user123",
            agent_id="agent1",
            title="Test Conversation",
        )
        assert conv.id == "conv-001"
        assert conv.user_id == "user123"
        assert conv.agent_id == "agent1"
    
    def test_conversation_uri(self):
        """Test URI generation"""
        conv = Conversation(
            id="conv-001",
            user_id="user123",
            agent_id="agent1",
            title="Test",
        )
        uri = conv.uri
        assert uri.startswith("mem://")
        assert "conversations" in uri
    
    def test_conversation_defaults(self):
        """Test default values"""
        conv = Conversation(
            id="conv-001",
            user_id="user123",
            agent_id="agent1",
        )
        assert conv.title is None
        assert conv.message_count == 0


class TestMessage:
    """Message model tests"""
    
    def test_message_creation(self):
        """Test creating message"""
        msg = Message(
            id="msg-001",
            conversation_id="conv-001",
            role="user",
            content="Hello",
        )
        assert msg.id == "msg-001"
        assert msg.role == "user"
        assert msg.content == "Hello"
    
    def test_message_defaults(self):
        """Test default values"""
        msg = Message(
            id="msg-001",
            conversation_id="conv-001",
            role="assistant",
            content="Response",
        )
        assert msg.tool_calls is None
        assert msg.reasoning is None


class TestConversationCreateInput:
    """ConversationCreateInput tests"""
    
    def test_create_input_defaults(self):
        """Test default values"""
        input = ConversationCreateInput(title="Test")
        assert input.source is None
    
    def test_create_input_custom(self):
        """Test custom values"""
        input = ConversationCreateInput(
            title="Test",
            source="web",
        )
        assert input.source == "web"


class TestMessageCreateInput:
    """MessageCreateInput tests"""
    
    def test_message_input_defaults(self):
        """Test default values"""
        input = MessageCreateInput(content="Test")
        assert input.role == "user"
    
    def test_message_input_custom(self):
        """Test custom values"""
        input = MessageCreateInput(
            content="Test",
            role="assistant",
            tool_calls=[{"name": "test"}],
        )
        assert input.role == "assistant"


class TestMessageRepository:
    """MessageRepository tests"""
    
    def test_initialization(self, mock_db):
        """Test initialization"""
        repo = MessageRepository(mock_db)
        assert repo._db == mock_db
    
    @pytest.mark.asyncio
    async def test_create(self, msg_repo, mock_db):
        """Test creating message"""
        # Setup conversation
        mock_db._conversations["conv-001"] = {"id": "conv-001"}
        mock_db._messages["conv-001"] = []
        
        input = MessageCreateInput(content="Hello")
        msg = await msg_repo.create("conv-001", input)
        
        assert msg.content == "Hello"
    
    @pytest.mark.asyncio
    async def test_list(self, msg_repo, mock_db):
        """Test listing messages"""
        mock_db._messages["conv-001"] = [
            {"id": "msg-001", "conversation_id": "conv-001", "role": "user", "content": "Hello"},
        ]
        
        msgs = await msg_repo.list("conv-001")
        assert len(msgs) >= 1


class TestConversationRepository:
    """ConversationRepository tests"""
    
    @pytest.mark.asyncio
    async def test_create(self, conv_repo, sample_scope):
        """Test creating conversation"""
        input = ConversationCreateInput(title="Test Conversation")
        conv = await conv_repo.create(sample_scope, input)
        
        assert conv.title == "Test Conversation"
        assert conv.user_id == "user123"
        assert conv.agent_id == "agent1"
    
    @pytest.mark.asyncio
    async def test_get(self, conv_repo, sample_scope, mock_db):
        """Test getting conversation"""
        input = ConversationCreateInput(title="Test")
        conv = await conv_repo.create(sample_scope, input)
        
        result = await conv_repo.get(sample_scope, conv.id)
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_get_with_messages(self, conv_repo, sample_scope, mock_db):
        """Test getting with messages"""
        input = ConversationCreateInput(title="Test")
        conv = await conv_repo.create(sample_scope, input)
        
        # Add message
        msg_input = MessageCreateInput(content="Hello")
        await conv_repo._message_repo.create(conv.id, msg_input)
        
        result = await conv_repo.get(sample_scope, conv.id, include_messages=True)
        assert result is not None
    
    @pytest.mark.asyncio
    async def test_list(self, conv_repo, sample_scope):
        """Test listing conversations"""
        input = ConversationCreateInput(title="Test")
        await conv_repo.create(sample_scope, input)
        
        convs = await conv_repo.list(sample_scope)
        assert len(convs) >= 1
    
    @pytest.mark.asyncio
    async def test_delete(self, conv_repo, sample_scope, mock_db):
        """Test deleting conversation"""
        input = ConversationCreateInput(title="Test")
        conv = await conv_repo.create(sample_scope, input)
        
        deleted = await conv_repo.delete(sample_scope, conv.id)
        assert deleted is True