# AGENTS.md — identity/

**Role**: L0 Identity Layer implementation
**Layer**: L0 (Foundation)
**Dependencies**: core/

---

## Module Overview

L0 is the foundation of the 4-layer architecture. It handles:
- Scope validation
- Access control and permissions
- Multi-tenant isolation via Scope Hash

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `layer.py` | Main L0 class | `IdentityLayer` |
| `auth.py` | Access control | `AccessControl`, `Permission` |
| `repository.py` | Identity storage | `IdentityRepository` |

---

## Key Concepts

### Scope Hash

Scope is hashed using SHA256 for database indexing:

```python
import hashlib

def compute_scope_hash(scope: Scope) -> str:
    """Generate deterministic hash for scope-based queries."""
    content = f"{scope.user_id}:{scope.agent_id or ''}:{scope.team_id or ''}"
    return hashlib.sha256(content.encode()).hexdigest()[:16]
```

**Why**: Fast scope-based queries in SQLite.

### Permission Model

```python
class Permission(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"
```

---

## IdentityLayer API

```python
# Initialize
identity = IdentityLayer()

# Validate scope (raises ScopeError if invalid)
identity.validate_scope(scope)

# Check permission (raises PermissionDeniedError if denied)
identity.access_control.check_permission(scope, resource, Permission.READ)

# Generate scope hash for queries
scope_hash = identity.compute_scope_hash(scope)
```

---

## Validation Rules

1. **user_id**: Required, non-empty string
2. **agent_id**: Optional, must be valid if provided
3. **team_id**: Optional, must be valid if provided
4. **Scope Hash**: Deterministic (same scope = same hash)

---

## Testing

```bash
pytest tests/test_identity/ -xvs
```

Test cases must cover:
- Valid/invalid scope validation
- Permission checks (allow/deny)
- Scope hash consistency
