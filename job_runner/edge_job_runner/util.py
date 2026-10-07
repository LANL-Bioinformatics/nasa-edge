"""Small helpers shared across the job-runner library."""

from __future__ import annotations

import os
from datetime import datetime, timezone
from pathlib import Path


def utc_now() -> str:
    """Return the current UTC time as an ISO-8601 string.

    Timestamps are stored as text so the SQLite state file stays inspectable
    with plain ``sqlite3``, and so lexical ordering matches chronological
    ordering for the scheduler's ``ORDER BY created_at``.
    """
    return datetime.now(timezone.utc).isoformat()


def read_secret(value_env: str, file_env: str) -> str:
    """Resolve a secret from an environment variable or a file.

    The file form is preferred in container deployments because the value never
    appears in the process environment (where it would be visible to anything
    that can read ``/proc/<pid>/environ``).

    :param value_env: Name of the variable holding the literal secret.
    :param file_env: Name of the variable holding a path to the secret.
    :return: The secret, or an empty string when neither is configured.
    """
    value = os.environ.get(value_env, "").strip()
    secret_file = os.environ.get(file_env, "").strip()
    if value:
        return value
    if secret_file:
        return Path(secret_file).read_text(encoding="utf-8").strip()
    return ""
