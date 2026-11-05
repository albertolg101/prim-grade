"""PL-32: the server refuses to start when it cannot price the model's calls."""

from pathlib import Path

import pytest
from primgrade_server import config


def test_missing_prices_stop_the_server(monkeypatch):
    monkeypatch.setenv("PRIMGRADE_SECRET_KEY", "k" * 40)
    monkeypatch.setattr(config, "load_prices", lambda: {})
    with pytest.raises(RuntimeError, match="no price for gpt-6.1-sol"):
        config.load()


def test_prices_file_has_the_model(monkeypatch):
    monkeypatch.setenv("PRIMGRADE_SECRET_KEY", "k" * 40)
    assert Path("prices.json").exists()
    assert config.load().llm in ("openai", "fake")
