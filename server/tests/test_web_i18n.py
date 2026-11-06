"""PL-37, AC-P17: every interface text the web app passes to t("…") has a Spanish and a Russian
translation, and every translation keeps the same {placeholders}."""

import json
import re
from pathlib import Path

WEB = Path(__file__).resolve().parents[2] / "web" / "src"
# t("…") or t('…') with a plain literal; template literals are not allowed as keys
CALL = re.compile(r"""\bt\(\s*(["'])((?:\\.|(?!\1).)*)\1""")
PLACEHOLDER = re.compile(r"\{(\w+)\}")
# Strings that are passed through t() as data (STATE labels, REASONS, tab names, server messages)
# are listed under "keys" in en.extra.json so the check sees them too.


def _unescape(s: str) -> str:
    return json.loads(f'"{s}"') if '"' not in s.replace('\\"', "") else s.replace('\\"', '"')


def used_keys() -> set[str]:
    keys = set()
    for f in WEB.rglob("*.ts*"):
        if "components/ui" in f.as_posix():
            continue
        code = "\n".join(line for line in f.read_text().splitlines()
                         if not line.lstrip().startswith(("*", "/*", "//")))
        keys |= {_unescape(m.group(2)) for m in CALL.finditer(code)}
    keys |= set(json.loads((WEB / "locales" / "en.extra.json").read_text())["keys"])
    return keys


def test_every_text_is_translated():
    keys = used_keys()
    assert len(keys) > 50
    for lang in ("es", "ru"):
        d = json.loads((WEB / "locales" / f"{lang}.json").read_text())
        missing = sorted(keys - d.keys())
        assert not missing, f"{lang}.json misses {len(missing)}: {missing[:20]}"
        for k in keys:
            assert set(PLACEHOLDER.findall(k)) == set(PLACEHOLDER.findall(d[k])), (lang, k)
