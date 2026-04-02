"""
LLM abstraction layer — Phase 3.

Provides a unified interface over multiple model providers via LangChain.
Only Claude is required; GPT-4o and Gemini are optional and gracefully
skipped when their packages or API keys are absent.

Usage
─────
    from tools.llm_tool import get_llm

    llm = get_llm("claude-sonnet-4-6")  # default
    llm = get_llm("gpt-4o")
    llm = get_llm("gemini-1.5-pro")

    # LangChain chat interface
    from langchain_core.messages import HumanMessage
    response = await llm.ainvoke([HumanMessage(content="Hello!")])
    print(response.content)

Install
───────
    pip install langchain-anthropic          # required
    pip install langchain-openai             # optional
    pip install langchain-google-genai       # optional
"""

import os
from typing import Optional

from config import settings
from observability.logger import get_logger

_logger = get_logger("llm_tool")

# Module-level cache: model_id → instantiated LangChain model
_models: dict = {}


# ── Builders ──────────────────────────────────────────────────────────────────

def _build_claude(model_id: str = "claude-sonnet-4-6"):
    try:
        from langchain_anthropic import ChatAnthropic
        key = settings.anthropic_api_key
        if not key:
            _logger.warning("ANTHROPIC_API_KEY not set — Claude LangChain model unavailable")
            return None
        return ChatAnthropic(model=model_id, api_key=key, max_tokens=4096)
    except ImportError:
        _logger.warning("langchain-anthropic not installed (pip install langchain-anthropic)")
        return None


def _build_gpt4o():
    try:
        from langchain_openai import ChatOpenAI
        key = os.getenv("OPENAI_API_KEY")
        if not key:
            return None
        return ChatOpenAI(model="gpt-4o", api_key=key)
    except ImportError:
        _logger.warning("langchain-openai not installed (pip install langchain-openai)")
        return None


def _build_gemini(model_id: str = "gemini-1.5-pro"):
    try:
        from langchain_google_genai import ChatGoogleGenerativeAI
        key = os.getenv("GOOGLE_AI_API_KEY")
        if not key:
            return None
        return ChatGoogleGenerativeAI(model=model_id, google_api_key=key)
    except ImportError:
        _logger.warning("langchain-google-genai not installed (pip install langchain-google-genai)")
        return None


# Canonical model IDs → builder callables
_REGISTRY: dict = {
    "claude-sonnet-4-6":  lambda: _build_claude("claude-sonnet-4-6"),
    "claude-opus-4-6":    lambda: _build_claude("claude-opus-4-6"),
    "claude-haiku-4-5":   lambda: _build_claude("claude-haiku-4-5-20251001"),
    "gpt-4o":             _build_gpt4o,
    "gemini-1.5-pro":     lambda: _build_gemini("gemini-1.5-pro"),
    "gemini-2.0-flash":   lambda: _build_gemini("gemini-2.0-flash"),
}

# Convenience aliases
_ALIASES: dict[str, str] = {
    "claude":   "claude-sonnet-4-6",
    "claude-3": "claude-sonnet-4-6",
    "gpt4o":    "gpt-4o",
    "gemini":   "gemini-1.5-pro",
}


# ── Public API ─────────────────────────────────────────────────────────────────

def get_llm(model_id: str = "claude-sonnet-4-6"):
    """
    Return a LangChain BaseChatModel for the given model_id.

    Falls back to Claude if the requested model is unavailable.
    Returns None only if Claude itself is unavailable (missing key/package).
    """
    canonical = _ALIASES.get(model_id, model_id)

    # Return cached instance
    if canonical in _models:
        return _models[canonical]

    builder = _REGISTRY.get(canonical)
    if builder:
        model = builder()
        if model is not None:
            _models[canonical] = model
            _logger.info(f"LLM initialised: {canonical}")
            return model

    # Fallback to default Claude
    if canonical != "claude-sonnet-4-6":
        _logger.warning(f"Model '{model_id}' unavailable — falling back to claude-sonnet-4-6")
        return get_llm("claude-sonnet-4-6")

    _logger.error("No LLM available — check API keys and packages")
    return None


def list_available_models() -> list[str]:
    """
    Return canonical model IDs that have both packages installed and API keys set.
    Useful for surfacing model options in the Settings UI.
    """
    available = []
    for mid, builder in _REGISTRY.items():
        try:
            m = builder()
            if m is not None:
                available.append(mid)
        except Exception:
            pass
    return available
