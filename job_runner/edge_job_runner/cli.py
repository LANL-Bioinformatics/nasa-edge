"""Shared entry point for application runner scripts.

An application's runner is a thin script that defines its
:class:`~edge_job_runner.tooling.ToolDefinition` subclasses and calls :func:`run`:

.. code-block:: python

    from edge_job_runner import ToolRegistry, cli

    cli.run(ToolRegistry(MyTool, MyOtherTool))
"""

from __future__ import annotations

import argparse
import os

from .executor import JobExecutor
from .server import serve
from .store import JobStore
from .tooling import ToolRegistry
from .util import read_secret

DEFAULT_STATE_DB = "/var/lib/edge-job-runner/jobs.sqlite3"
DEFAULT_ALLOWED_ROOTS = "/edge/io"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="EDGE durable HTTP job runner")
    parser.add_argument("--host", default=os.environ.get("RUNNER_HOST", "0.0.0.0"))
    parser.add_argument(
        "--port", type=int, default=int(os.environ.get("RUNNER_PORT", "7001"))
    )
    return parser.parse_args(argv)


def run(
    registry: ToolRegistry,
    argv: list[str] | None = None,
    *,
    default_state_db: str = DEFAULT_STATE_DB,
    default_allowed_roots: str = DEFAULT_ALLOWED_ROOTS,
) -> None:
    """Configure from the environment and serve until terminated.

    Reads ``RUNNER_TOOL``, ``RUNNER_ALLOWED_ROOTS``, ``RUNNER_STATE_DB``,
    ``RUNNER_CONCURRENCY``, and ``RUNNER_API_TOKEN``/``_FILE``.

    :param registry: The application's available tool definitions.
    :param default_state_db: Fallback when ``RUNNER_STATE_DB`` is unset.
    :param default_allowed_roots: Colon-separated fallback for
        ``RUNNER_ALLOWED_ROOTS``.
    """
    args = parse_args(argv)
    allowed_roots = [
        root
        for root in os.environ.get(
            "RUNNER_ALLOWED_ROOTS", default_allowed_roots
        ).split(os.pathsep)
        if root
    ]
    # Raises on an unknown RUNNER_TOOL, so misconfiguration fails at startup
    # rather than on the first submission.
    tool = registry.create(os.environ.get("RUNNER_TOOL", ""), allowed_roots)
    store = JobStore(os.environ.get("RUNNER_STATE_DB", default_state_db))
    executor = JobExecutor(
        store, tool, int(os.environ.get("RUNNER_CONCURRENCY", "1"))
    )
    api_token = read_secret("RUNNER_API_TOKEN", "RUNNER_API_TOKEN_FILE")
    serve(args.host, args.port, store, executor, tool, api_token)
