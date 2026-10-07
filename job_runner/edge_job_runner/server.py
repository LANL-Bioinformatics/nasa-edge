"""The HTTP job API, built on FastAPI.

Endpoints:

* ``GET    /health``          -- liveness, unauthenticated
* ``POST   /v1/jobs``         -- submit (idempotent)
* ``GET    /v1/jobs/<jobId>`` -- poll
* ``DELETE /v1/jobs/<jobId>`` -- cancel

The wire contract is fixed by the EDGE web server, which treats ``4xx`` as
permanent and ``5xx`` as retryable. FastAPI's defaults are overridden where they
would break that contract: a validation failure must be ``400`` with an
``{"error": ...}`` body, not FastAPI's ``422`` with ``{"detail": ...}``.
"""

from __future__ import annotations

import hmac
import uuid
from http import HTTPStatus
from typing import Any

from fastapi import Depends, FastAPI, Header, Request, Response
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator

from .errors import RequestError
from .executor import JobExecutor
from .store import JobStore
from .tooling import JOB_ID_PATTERN, PROJECT_ID_PATTERN, ToolDefinition

# Bounds the request body so a malformed Content-Length cannot exhaust memory.
MAX_REQUEST_BYTES = 1024 * 1024

# Messages returned for a rejected field. Pydantic's defaults ("Field required",
# "Input should be a valid dictionary") are less actionable, and these strings
# are written to the project log the user reads.
FIELD_MESSAGES = {
    "projectId": "projectId is invalid",
    "input": "input must be an object",
    "jobId": "jobId is invalid",
}


class UnauthorizedError(Exception):
    """Raised by the auth dependency so a handler can shape the response."""


class JobSubmission(BaseModel):
    """A validated ``POST /v1/jobs`` body.

    ``input`` stays an untyped mapping on purpose: its shape is defined by the
    tool, and each :class:`~edge_job_runner.tooling.ToolDefinition` validates it.
    Declaring a schema here would force the library to know about every tool.
    """

    projectId: str  # noqa: N815 - wire contract is camelCase
    input: dict[str, Any]
    jobId: str | None = None  # noqa: N815 - wire contract is camelCase

    @field_validator("projectId")
    @classmethod
    def _check_project_id(cls, value: str) -> str:
        if not PROJECT_ID_PATTERN.fullmatch(value):
            raise ValueError("projectId is invalid")
        return value

    @field_validator("jobId")
    @classmethod
    def _check_job_id(cls, value: str | None) -> str | None:
        # An absent or empty jobId means "generate one"; only reject a bad one.
        if value in (None, ""):
            return None
        if not JOB_ID_PATTERN.fullmatch(value):
            raise ValueError("jobId is invalid")
        return value


def _error(status: int, message: str) -> JSONResponse:
    """Build the error body the EDGE web server expects."""
    return JSONResponse(status_code=status, content={"error": message})


def _first_message(exc: RequestValidationError) -> str:
    """Extract one readable message from a validation error.

    The web server only reads ``error``, so a nested ``detail`` array would
    surface as an unhelpful string in the project log. Field-level messages are
    preferred over pydantic's generic wording.
    """
    for entry in exc.errors():
        location = [part for part in entry.get("loc", ()) if isinstance(part, str)]
        field = location[-1] if location else ""
        if field in FIELD_MESSAGES:
            return FIELD_MESSAGES[field]
        message = str(entry.get("msg", ""))
        # Pydantic prefixes messages raised from a custom validator.
        for prefix in ("Value error, ", "Assertion failed, "):
            if message.startswith(prefix):
                message = message[len(prefix) :]
        if message:
            return message
    return "Request is invalid"


def create_app(
    store: JobStore,
    executor: JobExecutor,
    tool: ToolDefinition,
    api_token: str,
) -> FastAPI:
    """Build the ASGI application.

    Returned rather than module-global so tests can construct isolated instances
    and a process can serve exactly one tool.
    """
    # No interactive docs: this is a private machine-to-machine API, and the
    # schema routes would be unauthenticated surface alongside /health.
    app = FastAPI(
        title="EDGE job runner",
        docs_url=None,
        redoc_url=None,
        openapi_url=None,
    )
    app.state.store = store
    app.state.executor = executor
    app.state.tool = tool
    app.state.api_token = api_token

    def require_authorization(authorization: str = Header(default="")) -> None:
        """Reject a request whose bearer token does not match.

        An unset token disables auth, for single-host deployments where the
        runner is not reachable off-box. Comparison is constant-time to avoid
        leaking the token through response timing.
        """
        if not app.state.api_token:
            return
        expected = f"Bearer {app.state.api_token}"
        if not hmac.compare_digest(authorization, expected):
            raise UnauthorizedError

    @app.exception_handler(UnauthorizedError)
    async def _unauthorized(request: Request, exc: Exception) -> JSONResponse:
        del request, exc
        return _error(HTTPStatus.UNAUTHORIZED, "Unauthorized")

    @app.exception_handler(StarletteHTTPException)
    async def _http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        """Reshape FastAPI's ``{"detail": ...}`` into ``{"error": ...}``.

        Routing failures (an unknown path or method) are raised by Starlette, and
        the web server only reads ``error``.
        """
        del request
        # Starlette says "Not Found"; the previous implementation said
        # "Not found". Keep the original casing so log lines stay comparable.
        detail = "Not found" if exc.status_code == HTTPStatus.NOT_FOUND else str(exc.detail)
        return _error(exc.status_code, detail)

    @app.exception_handler(RequestValidationError)
    async def _validation_failed(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        # 400 rather than FastAPI's 422: the web server keys its permanent /
        # transient decision on the status class.
        del request
        return _error(HTTPStatus.BAD_REQUEST, _first_message(exc))

    @app.middleware("http")
    async def limit_body_size(request: Request, call_next: Any) -> Response:
        """Reject an oversized body before it is buffered."""
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > MAX_REQUEST_BYTES:
            return _error(HTTPStatus.BAD_REQUEST, "Request body is too large")
        return await call_next(request)

    @app.get("/health")
    async def health() -> dict[str, str]:
        """Liveness probe. Unauthenticated so container health checks work."""
        return {"status": "ok", "tool": app.state.tool.name}

    @app.post("/v1/jobs", dependencies=[Depends(require_authorization)])
    async def submit(
        submission: JobSubmission,
        response: Response,
        idempotency_key: str = Header(default="", alias="Idempotency-Key"),
    ) -> Any:
        job_id = submission.jobId or str(uuid.uuid4())
        try:
            payload = app.state.tool.validate_auxiliary_paths(submission.input)
            command = app.state.tool.build_command(payload)
            # Default the key to the job id so a caller that omits the header
            # still gets replay protection.
            key = (idempotency_key or job_id).strip()
            if not key or len(key) > 256:
                raise RequestError("Idempotency-Key is invalid")
            job, created = app.state.store.create_job(
                job_id,
                key,
                submission.projectId,
                app.state.tool.name,
                payload,
                command,
            )
        except (RequestError, TypeError, ValueError) as error:
            # 4xx: the web server treats these as permanent and fails the job.
            return _error(HTTPStatus.BAD_REQUEST, str(error))
        # 202 for a new job, 200 for a replay, so callers can tell them apart.
        response.status_code = HTTPStatus.ACCEPTED if created else HTTPStatus.OK
        return job

    @app.get("/v1/jobs/{job_id}", dependencies=[Depends(require_authorization)])
    async def poll(job_id: str) -> Any:
        job = app.state.store.get_job(job_id)
        if job is None:
            return _error(HTTPStatus.NOT_FOUND, "Job not found")
        return job

    @app.delete(
        "/v1/jobs/{job_id}",
        dependencies=[Depends(require_authorization)],
        status_code=HTTPStatus.ACCEPTED,
    )
    async def cancel(job_id: str) -> Any:
        job = app.state.executor.cancel(job_id)
        if job is None:
            return _error(HTTPStatus.NOT_FOUND, "Job not found")
        return job

    return app


def serve(
    host: str,
    port: int,
    store: JobStore,
    executor: JobExecutor,
    tool: ToolDefinition,
    api_token: str,
) -> None:
    """Run the API under uvicorn until SIGTERM or SIGINT.

    uvicorn installs its own signal handlers and drains in-flight requests, so
    the executor only needs stopping once the server loop returns.
    """
    import uvicorn

    app = create_app(store, executor, tool, api_token)
    executor.start()
    server = uvicorn.Server(
        uvicorn.Config(app, host=host, port=port, log_level="info")
    )
    print(f"[job-runner] {tool.name} runner listening on {host}:{port}")
    try:
        server.run()
    finally:
        executor.stop()
