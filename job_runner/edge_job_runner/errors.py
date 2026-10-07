"""Errors shared across the job-runner library."""

from __future__ import annotations


class RequestError(ValueError):
    """An invalid API request.

    Raised by :class:`~edge_job_runner.tooling.ToolDefinition` while validating
    a submission, and surfaced to the client as HTTP 400. Use it for any input
    the caller could correct; it must never be used for transient conditions,
    because the webapp treats a 4xx as permanent and fails the job immediately.
    """
