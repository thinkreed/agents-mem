"""
Tests for core.uri module.

Tests URISystem class:
- build() method
- parse() method
- build_target_uri() method
- validate() method
- is_uri() method
- URIValidationError
"""

import pytest

from agents_mem.core.uri import (
    URISystem,
    Scope,
    MaterialURI,
    URIValidationError,
)


class TestURISystem:
    """URISystem class tests."""
    
    def test_build_basic(self):
        """Test building basic URI."""
        scope = Scope(user_id="user123")
        uri = URISystem.build(scope, "document", "doc-001")
        assert uri == "mem://user123/_/_/document/doc-001"
    
    def test_build_with_agent(self):
        """Test building URI with agent."""
        scope = Scope(user_id="user123", agent_id="agent1")
        uri = URISystem.build(scope, "document", "doc-001")
        assert uri == "mem://user123/agent1/_/document/doc-001"
    
    def test_build_with_team(self):
        """Test building URI with team."""
        scope = Scope(user_id="user123", team_id="team1")
        uri = URISystem.build(scope, "document", "doc-001")
        assert uri == "mem://user123/_/team1/document/doc-001"
    
    def test_build_full(self):
        """Test building full URI."""
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team1")
        uri = URISystem.build(scope, "document", "doc-001")
        assert uri == "mem://user123/agent1/team1/document/doc-001"
    
    def test_build_missing_user_id(self):
        """Test building URI without user_id raises error."""
        scope = Scope(user_id="")  # Empty user_id
        with pytest.raises(URIValidationError):
            URISystem.build(scope, "document", "doc-001")
    
    def test_build_missing_resource_type(self):
        """Test building URI without resource_type raises error."""
        scope = Scope(user_id="user123")
        with pytest.raises(URIValidationError):
            URISystem.build(scope, "", "doc-001")
    
    def test_build_missing_resource_id(self):
        """Test building URI without resource_id raises error."""
        scope = Scope(user_id="user123")
        with pytest.raises(URIValidationError):
            URISystem.build(scope, "document", "")
    
    def test_parse_basic(self):
        """Test parsing basic URI."""
        uri = "mem://user123/_/_/document/doc-001"
        result = URISystem.parse(uri)
        assert result.user_id == "user123"
        assert result.agent_id is None
        assert result.team_id is None
        assert result.resource_type == "document"
        assert result.resource_id == "doc-001"
    
    def test_parse_with_agent(self):
        """Test parsing URI with agent."""
        uri = "mem://user123/agent1/_/document/doc-001"
        result = URISystem.parse(uri)
        assert result.user_id == "user123"
        assert result.agent_id == "agent1"
        assert result.team_id is None
    
    def test_parse_with_team(self):
        """Test parsing URI with team."""
        uri = "mem://user123/_/team1/document/doc-001"
        result = URISystem.parse(uri)
        assert result.user_id == "user123"
        assert result.agent_id is None
        assert result.team_id == "team1"
    
    def test_parse_full(self):
        """Test parsing full URI."""
        uri = "mem://user123/agent1/team1/document/doc-001"
        result = URISystem.parse(uri)
        assert result.user_id == "user123"
        assert result.agent_id == "agent1"
        assert result.team_id == "team1"
        assert result.resource_type == "document"
        assert result.resource_id == "doc-001"
    
    def test_parse_empty(self):
        """Test parsing empty URI raises error."""
        with pytest.raises(URIValidationError):
            URISystem.parse("")
    
    def test_parse_invalid_format(self):
        """Test parsing invalid format raises error."""
        with pytest.raises(URIValidationError):
            URISystem.parse("invalid://uri")
        
        with pytest.raises(URIValidationError):
            URISystem.parse("mem://user123/document/doc-001")  # Missing agent/team
    
    def test_parse_returns_material_uri(self):
        """Test parse returns MaterialURI model."""
        uri = "mem://user123/agent1/team1/document/doc-001"
        result = URISystem.parse(uri)
        assert isinstance(result, MaterialURI)
    
    def test_build_target_uri_basic(self):
        """Test building target URI (without resource_id)."""
        scope = Scope(user_id="user123")
        uri = URISystem.build_target_uri(scope, "document")
        assert uri == "mem://user123/_/_/document"
    
    def test_build_target_uri_with_agent(self):
        """Test building target URI with agent."""
        scope = Scope(user_id="user123", agent_id="agent1")
        uri = URISystem.build_target_uri(scope, "document")
        assert uri == "mem://user123/agent1/_/document"
    
    def test_build_target_uri_missing_user(self):
        """Test building target URI without user raises error."""
        scope = Scope(user_id="")
        with pytest.raises(URIValidationError):
            URISystem.build_target_uri(scope, "document")
    
    def test_validate_valid_uri(self):
        """Test validating valid URI."""
        assert URISystem.validate("mem://user123/_/_/document/doc-001") is True
        assert URISystem.validate("mem://user123/agent1/team1/document/doc-001") is True
    
    def test_validate_invalid_uri(self):
        """Test validating invalid URI."""
        assert URISystem.validate("invalid://uri") is False
        assert URISystem.validate("mem://user123/document/doc-001") is False
        assert URISystem.validate("") is False
        assert URISystem.validate(None) is False
    
    def test_is_uri_with_string(self):
        """Test is_uri type guard with string."""
        assert URISystem.is_uri("mem://user123/_/_/document/doc-001") is True
        assert URISystem.is_uri("invalid") is False
    
    def test_is_uri_with_non_string(self):
        """Test is_uri type guard with non-string."""
        assert URISystem.is_uri(None) is False
        assert URISystem.is_uri(123) is False
        assert URISystem.is_uri(["uri"]) is False
        assert URISystem.is_uri({"uri": "value"}) is False


class TestScope:
    """Scope model tests for URI module."""
    
    def test_scope_creation(self):
        """Test Scope creation."""
        scope = Scope(user_id="user123")
        assert scope.user_id == "user123"
        assert scope.agent_id is None
        assert scope.team_id is None
    
    def test_scope_with_agent(self):
        """Test Scope with agent."""
        scope = Scope(user_id="user123", agent_id="agent1")
        assert scope.agent_id == "agent1"
    
    def test_scope_with_team(self):
        """Test Scope with team."""
        scope = Scope(user_id="user123", team_id="team1")
        assert scope.team_id == "team1"


class TestMaterialURI:
    """MaterialURI model tests for URI module."""
    
    def test_material_uri_creation(self):
        """Test MaterialURI creation."""
        uri = MaterialURI(
            user_id="user123",
            agent_id="agent1",
            team_id="team1",
            resource_type="document",
            resource_id="doc-001",
        )
        assert uri.scheme == "mem"
        assert uri.user_id == "user123"
        assert uri.resource_type == "document"
        assert uri.resource_id == "doc-001"
    
    def test_material_uri_defaults(self):
        """Test MaterialURI default values."""
        uri = MaterialURI(
            user_id="user123",
            resource_type="document",
            resource_id="doc-001",
        )
        assert uri.scheme == "mem"
        assert uri.agent_id is None
        assert uri.team_id is None


class TestURIValidationError:
    """URIValidationError tests."""
    
    def test_error_creation(self):
        """Test error creation."""
        error = URIValidationError("Invalid URI")
        assert str(error) == "Invalid URI"
    
    def test_error_with_uri(self):
        """Test error with URI."""
        error = URIValidationError("Invalid URI", uri="test://uri")
        assert error.uri == "test://uri"


class TestURISystemIntegration:
    """Integration tests for URISystem."""
    
    def test_build_parse_cycle(self):
        """Test building and parsing URI."""
        scope = Scope(user_id="user123", agent_id="agent1", team_id="team1")
        
        # Build
        uri = URISystem.build(scope, "document", "doc-001")
        
        # Parse
        parsed = URISystem.parse(uri)
        
        # Verify
        assert parsed.user_id == scope.user_id
        assert parsed.agent_id == scope.agent_id
        assert parsed.team_id == scope.team_id
        assert parsed.resource_type == "document"
        assert parsed.resource_id == "doc-001"
    
    def test_multiple_resource_types(self):
        """Test building URIs for different resource types."""
        scope = Scope(user_id="user123")
        
        resource_types = [
            "document",
            "asset",
            "conversation",
            "message",
            "fact",
            "team",
        ]
        
        for rt in resource_types:
            uri = URISystem.build(scope, rt, f"{rt}-001")
            assert f"/{rt}/{rt}-001" in uri
            
            parsed = URISystem.parse(uri)
            assert parsed.resource_type == rt