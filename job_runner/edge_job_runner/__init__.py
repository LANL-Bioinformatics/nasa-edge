"""Durable HTTP job runner library.

Provides the shared, tool-agnostic half of the EDGE job runner:

* :class:`~edge_job_runner.store.JobStore` -- crash-safe SQLite job state
* :class:`~edge_job_runner.executor.JobExecutor` -- process supervision
* :func:`~edge_job_runner.server.serve` -- the HTTP job API (FastAPI/uvicorn)
* :class:`~edge_job_runner.tooling.ToolDefinition` -- the extension point

Each application supplies its own :class:`ToolDefinition` subclass describing
how its command lines are built, then calls :func:`~edge_job_runner.cli.run`.
Nothing tool-specific belongs in this package.
"""

from .errors import RequestError
from .executor import JobExecutor
from .server import create_app, serve
from .store import TERMINAL_STATUSES, JobStore
from .tooling import ToolDefinition, ToolRegistry
from .util import read_secret, utc_now

__all__ = [
    "JobExecutor",
    "JobStore",
    "RequestError",
    "TERMINAL_STATUSES",
    "ToolDefinition",
    "ToolRegistry",
    "create_app",
    "read_secret",
    "serve",
    "utc_now",
]
