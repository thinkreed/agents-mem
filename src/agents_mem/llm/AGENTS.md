# AGENTS.md — llm/

**Role**: LLM client integration for tiered summarization and knowledge extraction
**Layer**: Foundation (used by L2 Content, L3 Knowledge)
**Dependencies**: httpx

---

## Module Overview

This module provides LLM text generation via Ollama. Used for tiered view generation and fact extraction.

### Files

| File | Purpose | Key Classes |
|------|---------|-------------|
| `__init__.py` | Main module (268 lines) | `OllamaLLMClient`, `MockLLMClient`, `LLMClientProtocol`, `LLMClientError` |

---

## Key Classes

### OllamaLLMClient

Production client connecting to Ollama service.

```python
client = OllamaLLMClient()
summary = await client.generate(prompt, max_tokens=100)
# Returns: str (generated text)
```

| Method | Description | Return Type |
|--------|-------------|-------------|
| `generate(prompt, ...)` | Single generation | `str` |
| `generate_stream(prompt, ...)` | Streaming generation | `AsyncGenerator[str]` |
| `count_tokens(text)` | Token estimation | `int` |

### MockLLMClient

Testing client with deterministic output (truncates prompt).

### LLMClientProtocol

Type protocol for dependency injection. Enables swapping implementations.

---

## Layer Connections

| Layer | Usage |
|-------|-------|
| **L2 Content** | `TieredViewCapability` generates L0/L1 summaries |
| **L3 Knowledge** | `FactExtractor`, `EntityAggregator` extract knowledge |

---

## Token Budget Integration

| Tier | Max Tokens | Temperature | Purpose |
|------|------------|-------------|---------|
| **L0** | ~100 | 0.3 | Quick summary (deterministic) |
| **L1** | ~2000 | 0.5 | Detailed overview (balanced) |
| **L2** | Full | - | Original content |

---

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `OLLAMA_HOST` | `localhost:11434` | Ollama service address |
| `OLLAMA_MODEL` | `bge-m3` | LLM model |

---

## Token Estimation Heuristic

```python
# Chinese: ~1.5 tokens/char
# English: ~1.3 tokens/word
# Other: ~0.5 tokens/char
tokens = client.count_tokens("中文内容 English text")
```

---

## Testing

```bash
pytest tests/test_llm/ -xvs
```

**Coverage requirement**: 100%

---

## Error Handling

```python
try:
    result = await client.generate(prompt)
except LLMClientError as e:
    # Handle: Ollama unavailable, timeout, etc.
    logger.warning(f"LLM generation failed: {e}")
```