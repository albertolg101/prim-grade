def clean(name: str) -> str:
    return " ".join(name.split())


def key(name: str) -> str:
    """Same student, same key: case and spacing do not matter (PL-31, PL-35)."""
    return clean(name).lower()  # matches SQL lower() in queries
