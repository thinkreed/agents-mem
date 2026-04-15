"""
URI System for agents-mem

Provides URI parsing and building for mem:// scheme.
Format: mem://{user_id}/{agent_id or "_"}/{team_id or "_"}/{resource_type}/{resource_id}
"""

import re
from typing import Optional

from pydantic import BaseModel, Field, ValidationError


class Scope(BaseModel):
    """Scope for resource isolation."""
    user_id: str = Field(..., description="User ID (required)")
    agent_id: Optional[str] = Field(None, description="Agent ID (optional)")
    team_id: Optional[str] = Field(None, description="Team ID (optional)")


class MaterialURI(BaseModel):
    """Material URI model for mem:// scheme."""
    scheme: str = Field(default="mem", description="URI scheme")
    user_id: str = Field(..., description="User ID")
    agent_id: Optional[str] = Field(None, description="Agent ID (optional)")
    team_id: Optional[str] = Field(None, description="Team ID (optional)")
    resource_type: str = Field(..., description="Resource type")
    resource_id: str = Field(..., description="Resource ID")


class URIValidationError(Exception):
    """Raised when URI validation fails."""
    def __init__(self, message: str, uri: Optional[str] = None):
        self.uri = uri
        super().__init__(message)


class URISystem:
    """
    URI System for building and parsing mem:// URIs.
    
    Format: mem://{user_id}/{agent_id or "_"}/{team_id or "_"}/{resource_type}/{resource_id}
    """
    
    # URI format regex: mem://{user_id}/{agent_id?}/{team_id?}/{resource_type}/{resource_id}
    URI_FORMAT = re.compile(
        r"^mem://([^/]+)/([^/]+)/([^/]+)/([^/]+)/([^/]+)$"
    )
    
    # Placeholder for missing agent_id/team_id
    PLACEHOLDER = "_"
    
    @classmethod
    def build(
        cls,
        scope: Scope,
        resource_type: str,
        resource_id: str
    ) -> str:
        """
        Build a mem:// URI string from scope and resource info.
        
        Args:
            scope: Scope with user_id (required), agent_id (optional), team_id (optional)
            resource_type: Resource type (e.g., "document", "conversation")
            resource_id: Resource ID
            
        Returns:
            URI string in format: mem://{user_id}/{agent_id or "_"}/{team_id or "_"}/{resource_type}/{resource_id}
            
        Raises:
            URIValidationError: If required fields are missing
            
        Example:
            >>> scope = Scope(user_id="user123", agent_id="agent1")
            >>> URISystem.build(scope, "document", "doc-456")
            'mem://user123/agent1/_/document/doc-456'
        """
        # Validate required fields
        if not scope.user_id:
            raise URIValidationError("user_id is required")
        
        if not resource_type:
            raise URIValidationError("resource_type is required")
        
        if not resource_id:
            raise URIValidationError("resource_id is required")
        
        agent_path = scope.agent_id if scope.agent_id else cls.PLACEHOLDER
        team_path = scope.team_id if scope.team_id else cls.PLACEHOLDER
        
        return (
            f"mem://{scope.user_id}/"
            f"{agent_path}/"
            f"{team_path}/"
            f"{resource_type}/"
            f"{resource_id}"
        )
    
    @classmethod
    def parse(cls, uri: str) -> MaterialURI:
        """
        Parse a mem:// URI string to MaterialURI model.
        
        Args:
            uri: URI string to parse
            
        Returns:
            MaterialURI model with parsed components
            
        Raises:
            URIValidationError: If URI format is invalid
            
        Example:
            >>> uri = "mem://user123/agent1/_/document/doc-456"
            >>> result = URISystem.parse(uri)
            >>> result.user_id
            'user123'
            >>> result.resource_type
            'document'
        """
        if not uri:
            raise URIValidationError("URI cannot be empty", uri)
        
        match = cls.URI_FORMAT.match(uri)
        
        if not match:
            raise URIValidationError(
                f"Invalid URI format: {uri}. Expected format: "
                f"mem://{{user_id}}/{{agent_id or '_'}}/{{team_id or '_'}}/{{resource_type}}/{{resource_id}}",
                uri
            )
        
        user_id = match.group(1)
        agent_path = match.group(2)
        team_path = match.group(3)
        resource_type = match.group(4)
        resource_id = match.group(5)
        
        # Convert placeholder back to None
        agent_id = None if agent_path == cls.PLACEHOLDER else agent_path
        team_id = None if team_path == cls.PLACEHOLDER else team_path
        
        return MaterialURI(
            scheme="mem",
            user_id=user_id,
            agent_id=agent_id,
            team_id=team_id,
            resource_type=resource_type,
            resource_id=resource_id
        )
    
    @classmethod
    def build_target_uri(
        cls,
        scope: Scope,
        resource_type: str
    ) -> str:
        """
        Build a search target URI (without resource_id).
        
        Used for searching all resources of a specific type within a scope.
        
        Args:
            scope: Scope with user_id (required), agent_id (optional), team_id (optional)
            resource_type: Resource type to search for
            
        Returns:
            Target URI string in format: mem://{user_id}/{agent_id or "_"}/{team_id or "_"}/{resource_type}
            
        Raises:
            URIValidationError: If required fields are missing
            
        Example:
            >>> scope = Scope(user_id="user123")
            >>> URISystem.build_target_uri(scope, "document")
            'mem://user123/_/_/document'
        """
        if not scope.user_id:
            raise URIValidationError("user_id is required")
        
        if not resource_type:
            raise URIValidationError("resource_type is required")
        
        agent_path = scope.agent_id if scope.agent_id else cls.PLACEHOLDER
        team_path = scope.team_id if scope.team_id else cls.PLACEHOLDER
        
        return (
            f"mem://{scope.user_id}/"
            f"{agent_path}/"
            f"{team_path}/"
            f"{resource_type}"
        )
    
    @classmethod
    def validate(cls, uri: str) -> bool:
        """
        Validate if a string is a valid mem:// URI.
        
        Args:
            uri: URI string to validate
            
        Returns:
            True if valid, False otherwise
        """
        if not uri:
            return False
        return cls.URI_FORMAT.match(uri) is not None
    
    @classmethod
    def is_uri(cls, value: any) -> bool:
        """
        Type guard to check if a value is a valid URI string.
        
        Args:
            value: Value to check
            
        Returns:
            True if value is a valid URI string, False otherwise
        """
        if not isinstance(value, str):
            return False
        return cls.validate(value)
