"""The only module that talks to OpenAI. Tests inject a fake with the same signature."""

import base64
import json
import os
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TypeVar

from openai import AsyncOpenAI
from pydantic import BaseModel

from .schemas import Usage

T = TypeVar("T", bound=BaseModel)

# (model, instructions, text, image paths, output schema) -> (parsed output, usage)
LLM = Callable[[str, str, str, list[Path], type[T]], Awaitable[tuple[T, Usage]]]

IMAGE_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}

PRICES_PATH = Path(os.environ.get("PRIMGRADE_PRICES", "prices.json"))


class LLMError(Exception):
    pass


def configured_models() -> list[str]:
    raw = os.environ.get("PRIMGRADE_MODELS", "gpt-6-luna,gpt-6.1-terra,gpt-6.1-sol,gpt-6-astra")
    return [m.strip() for m in raw.split(",") if m.strip()]


def load_prices() -> dict:
    if not PRICES_PATH.exists():
        return {}
    return {k: v for k, v in json.loads(PRICES_PATH.read_text()).items() if not k.startswith("_")}


def cost_usd(model: str, usage: Usage, prices: dict) -> float | None:
    """USD per 1M tokens from prices.json; None when the price is unknown."""
    p = prices.get(model) or {}
    inp, out = p.get("input_per_1m"), p.get("output_per_1m")
    if inp is None or out is None:
        return None
    cached = p.get("cached_input_per_1m")
    cached = inp if cached is None else cached
    fresh = usage.input_tokens - usage.cached_tokens
    return (fresh * inp + usage.cached_tokens * cached + usage.output_tokens * out) / 1_000_000


def _image_part(path: Path) -> dict:
    mime = IMAGE_TYPES[path.suffix.lower()]
    b64 = base64.b64encode(path.read_bytes()).decode()
    return {"type": "input_image", "image_url": f"data:{mime};base64,{b64}", "detail": "high"}


_client: AsyncOpenAI | None = None


async def call_structured[T: BaseModel](
    model: str, instructions: str, text: str, images: list[Path], schema: type[T]
) -> tuple[T, Usage]:
    global _client
    if _client is None:
        _client = AsyncOpenAI()  # reads OPENAI_API_KEY
    content = [{"type": "input_text", "text": text}] + [_image_part(p) for p in images]
    resp = await _client.responses.parse(
        model=model,
        instructions=instructions,
        input=[{"role": "user", "content": content}],
        text_format=schema,
    )
    if resp.output_parsed is None:
        raise LLMError(f"no structured output (status={resp.status}, refusal or incomplete)")
    u = resp.usage
    usage = Usage(
        input_tokens=u.input_tokens,
        cached_tokens=u.input_tokens_details.cached_tokens or 0,
        output_tokens=u.output_tokens,
        reasoning_tokens=u.output_tokens_details.reasoning_tokens or 0,
        total_tokens=u.total_tokens,
    )
    usage.cost_usd = cost_usd(model, usage, load_prices())
    return resp.output_parsed, usage
