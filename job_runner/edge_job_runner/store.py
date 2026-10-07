"""Crash-safe job state, persisted in SQLite."""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from .errors import RequestError
from .util import utc_now

# Statuses from which a job never transitions again.
TERMINAL_STATUSES = {"succeeded", "failed", "cancelled"}


class JobStore:
    """Durable job records.

    SQLite is used rather than in-memory state so that a runner restart cannot
    lose track of submitted work: the webapp persists its job handle *before*
    submitting, and relies on being able to poll that handle afterwards.
    """

    def __init__(self, database_path: str):
        self.database_path = database_path
        Path(database_path).parent.mkdir(parents=True, exist_ok=True)
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        # A generous timeout lets the scheduler thread and the HTTP threads
        # contend for the write lock without spurious "database is locked".
        connection = sqlite3.connect(self.database_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            # WAL keeps readers from blocking the writer, which matters because
            # every HTTP GET reads while the scheduler may be writing.
            connection.execute("PRAGMA journal_mode=WAL")
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    idempotency_key TEXT NOT NULL UNIQUE,
                    project_id TEXT NOT NULL,
                    tool TEXT NOT NULL,
                    status TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    command TEXT NOT NULL,
                    pid INTEGER,
                    exit_code INTEGER,
                    error TEXT,
                    cancel_requested INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL,
                    started_at TEXT,
                    finished_at TEXT,
                    updated_at TEXT NOT NULL
                )
                """
            )

    def recover_interrupted_jobs(self) -> None:
        """Fail jobs that were running when the process died.

        Their child processes did not survive the restart, so leaving them
        ``running`` would strand them forever: nothing would ever reap them and
        the webapp would poll a job that can never finish.
        """
        now = utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE jobs
                SET status = 'failed', pid = NULL, exit_code = NULL,
                    error = 'Worker restarted while the job was running',
                    finished_at = ?, updated_at = ?
                WHERE status = 'running'
                """,
                (now, now),
            )

    def create_job(
        self,
        job_id: str,
        idempotency_key: str,
        project_id: str,
        tool: str,
        payload: dict[str, Any],
        command: list[str],
    ) -> tuple[dict[str, Any], bool]:
        """Insert a job, or return the existing one for a replayed submission.

        The unique constraint on ``idempotency_key`` is what makes submission
        safe to retry: a request interrupted after the insert committed can be
        replayed and will return the original job instead of starting a second
        execution.

        :return: ``(job, created)`` where ``created`` is False for a replay.
        :raises RequestError: If the key was reused with a different payload,
            which indicates a caller bug rather than a retry.
        """
        now = utc_now()
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO jobs (
                        id, idempotency_key, project_id, tool, status,
                        payload, command, created_at, updated_at
                    ) VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?)
                    """,
                    (
                        job_id,
                        idempotency_key,
                        project_id,
                        tool,
                        json.dumps(payload, sort_keys=True),
                        json.dumps(command),
                        now,
                        now,
                    ),
                )
            return self.get_job(job_id), True
        except sqlite3.IntegrityError:
            with self._connect() as connection:
                row = connection.execute(
                    """
                    SELECT * FROM jobs
                    WHERE idempotency_key = ? OR id = ?
                    LIMIT 1
                    """,
                    (idempotency_key, job_id),
                ).fetchone()
            if row is None:
                raise
            if (
                row["idempotency_key"] != idempotency_key
                or row["project_id"] != project_id
                or row["tool"] != tool
                or json.loads(row["payload"]) != payload
                or json.loads(row["command"]) != command
            ):
                raise RequestError("Idempotency key is already used by another job")
            return self._row_to_job(row), False

    def _row_to_job(self, row: sqlite3.Row | None) -> dict[str, Any] | None:
        """Project a row onto the public API shape.

        Deliberately omits ``payload``, ``command``, and ``pid``: those are
        internal, and the command line can contain paths the caller has no
        business seeing echoed back.
        """
        if row is None:
            return None
        return {
            "jobId": row["id"],
            "projectId": row["project_id"],
            "tool": row["tool"],
            "status": row["status"],
            "exitCode": row["exit_code"],
            "error": row["error"],
            "cancelRequested": bool(row["cancel_requested"]),
            "createdAt": row["created_at"],
            "startedAt": row["started_at"],
            "finishedAt": row["finished_at"],
            "updatedAt": row["updated_at"],
        }

    def get_job(self, job_id: str) -> dict[str, Any] | None:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
        return self._row_to_job(row)

    def queued_job_ids(self, limit: int) -> list[str]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT id FROM jobs
                WHERE status = 'queued' AND cancel_requested = 0
                ORDER BY created_at ASC LIMIT ?
                """,
                (limit,),
            ).fetchall()
        return [row["id"] for row in rows]

    def claim_job(self, job_id: str) -> dict[str, Any] | None:
        """Atomically transition a queued job to running.

        The status guard in the UPDATE is the claim: if two scheduler passes race
        for the same job, only the one whose UPDATE reports a row wins, so a job
        can never be started twice.

        :return: The claimed job including ``payload`` and ``command``, or None
            if it was already claimed or cancelled.
        """
        now = utc_now()
        with self._connect() as connection:
            cursor = connection.execute(
                """
                UPDATE jobs SET status = 'running', started_at = ?, updated_at = ?
                WHERE id = ? AND status = 'queued' AND cancel_requested = 0
                """,
                (now, now, job_id),
            )
            if cursor.rowcount != 1:
                return None
            row = connection.execute(
                "SELECT * FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
        job = self._row_to_job(row)
        if job is not None:
            job["payload"] = json.loads(row["payload"])
            job["command"] = json.loads(row["command"])
        return job

    def set_pid(self, job_id: str, pid: int) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE jobs SET pid = ?, updated_at = ? WHERE id = ?",
                (pid, utc_now(), job_id),
            )

    def finish_job(
        self, job_id: str, status: str, exit_code: int | None, error: str | None
    ) -> None:
        now = utc_now()
        with self._connect() as connection:
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, pid = NULL, exit_code = ?, error = ?,
                    finished_at = ?, updated_at = ?
                WHERE id = ?
                """,
                (status, exit_code, error, now, now, job_id),
            )

    def request_cancel(self, job_id: str) -> dict[str, Any] | None:
        """Record a cancellation request.

        A queued job is cancelled outright, since no process exists yet. A
        running job is only flagged: the executor observes the flag and signals
        the process group, then reports the terminal status itself.
        """
        now = utc_now()
        with self._connect() as connection:
            row = connection.execute(
                "SELECT status FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
            if row is None:
                return None
            if row["status"] == "queued":
                connection.execute(
                    """
                    UPDATE jobs
                    SET status = 'cancelled', cancel_requested = 1,
                        finished_at = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, now, job_id),
                )
            elif row["status"] not in TERMINAL_STATUSES:
                connection.execute(
                    """
                    UPDATE jobs SET cancel_requested = 1, updated_at = ?
                    WHERE id = ?
                    """,
                    (now, job_id),
                )
        return self.get_job(job_id)

    def is_cancel_requested(self, job_id: str) -> bool:
        with self._connect() as connection:
            row = connection.execute(
                "SELECT cancel_requested FROM jobs WHERE id = ?", (job_id,)
            ).fetchone()
        return bool(row and row["cancel_requested"])
