# Job runner library

The shared, tool-agnostic half of the EDGE job runner. Applications supply their
own tool definitions; everything else lives here.

## What is shared

| Module | Responsibility |
| --- | --- |
| `store.py` | Crash-safe job state in SQLite: idempotent submission, atomic claim, cancellation, restart recovery |
| `executor.py` | Claims queued jobs, supervises child processes, handles cancellation and the `.done` flag |
| `server.py` | The HTTP job API (FastAPI) and bearer-token auth |
| `tooling.py` | `ToolDefinition` (the extension point) and `ToolRegistry` |
| `cli.py` | Environment-driven startup shared by application runner scripts |

## Dependencies

The API is served by FastAPI under uvicorn:

```bash
pip install -r requirements.txt
```

`httpx` is listed for `fastapi.testclient` and is needed only to run the tests;
the runtime needs `fastapi` and `uvicorn` alone. uvicorn is installed without
the `[standard]` extras, which would add native wheels this API does not use.

Everything else comes from the standard library, including `sqlite3`.

Because the runner now has third-party dependencies, an image must be rebuilt
after a library change; bind-mounting an updated copy into an already-published
image is no longer sufficient on its own.

## The HTTP contract

```
GET    /health          -> {"status": "ok", "tool": "<name>"}   (unauthenticated)
POST   /v1/jobs         -> 202 new job, 200 replay of an existing one
GET    /v1/jobs/<jobId> -> current job state
DELETE /v1/jobs/<jobId> -> 202, cancellation requested
```

Submissions carry `Idempotency-Key` (defaulting to the job id). Replaying a
submission returns the original job rather than starting a second execution,
which is what lets a caller persist its job handle *before* submitting and retry
safely if the request is interrupted.

Status values are `queued`, `running`, `succeeded`, `failed`, and `cancelled`.

`4xx` responses are permanent: the caller cannot succeed by retrying, and the
webapp fails the job immediately. `5xx`, timeouts, and network errors are
transient and are retried. Keep that distinction intact when adding validation --
raise `RequestError` only for input the caller could correct.

Two FastAPI defaults are deliberately overridden to hold that contract:

* a request-validation failure returns `400`, not FastAPI's `422`;
* every error body is `{"error": "..."}`, not `{"detail": ...}`, including the
  routing failures Starlette raises.

The interactive docs and `openapi.json` are disabled. This is a private
machine-to-machine API, and those routes would be unauthenticated surface
alongside `/health`.

## Adding a tool

Subclass `ToolDefinition`, register it, and delegate startup to `cli.run`:

```python
from edge_job_runner import RequestError, ToolDefinition, ToolRegistry, cli

class MyTool(ToolDefinition):
    name = "mytool"
    # Keys that must resolve inside the allowed roots on every submission.
    required_paths = ("logPath", "donePath", "workDir")

    def build_command(self, payload):
        # Use self.path()/self.optional_path() so paths are validated the same
        # way everywhere; bypassing them reopens path traversal.
        source = self.path(payload, "inputPath", must_exist=True)
        return [self.executable("MYTOOL_EXEC", "/usr/bin/mytool"), "-i", source]

cli.run(ToolRegistry(MyTool))
```

Rules worth keeping:

* Return an **argument array**, never a shell string. Payloads contain
  caller-supplied paths, and a shell string makes them injectable.
* Validate every path through `self.path()` / `self.optional_path()`.
* Read deployment-wide settings (executables, CPU counts, reference data) from
  the environment, not from the payload.
* Unknown payload keys are ignored, so one webapp can send a superset payload to
  runners that consume different subsets of it.

## Configuration

| Variable | Purpose |
| --- | --- |
| `RUNNER_TOOL` | Which registered tool this process serves |
| `RUNNER_HOST` / `RUNNER_PORT` | Listen address (default `0.0.0.0:7001`) |
| `RUNNER_ALLOWED_ROOTS` | `os.pathsep`-separated roots submissions may reference |
| `RUNNER_STATE_DB` | SQLite state file; must be on a persistent volume |
| `RUNNER_CONCURRENCY` | Maximum simultaneous jobs (default 1) |
| `RUNNER_API_TOKEN` / `_FILE` | Bearer token; the file form keeps it out of the environment |
| `RUNNER_WORK_DIR` | Working directory for spawned processes |

`RUNNER_TOOL` is internal to the runner. It is unrelated to the service or
hostname the webapp connects to, which the webapp configures separately.

## Tests

```
pip install -r requirements.txt
python3 -m pytest tests/
```

The API tests drive the ASGI application through `fastapi.testclient`, so they
bind no sockets.

These cover the store, executor, HTTP API, and the `ToolDefinition` contract
using fixture tools. Application tool definitions are tested in their own
repositories.
