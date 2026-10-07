"""Process supervision for queued jobs."""

from __future__ import annotations

import os
import signal
import subprocess
import threading
from pathlib import Path
from typing import Any

from .store import TERMINAL_STATUSES, JobStore
from .tooling import ToolDefinition


class JobExecutor:
    """Claims queued jobs and supervises their child processes.

    :param concurrency: Maximum simultaneously running jobs. Coerced to at least
        one, since zero would silently stall the queue.
    """

    def __init__(self, store: JobStore, tool: ToolDefinition, concurrency: int):
        self.store = store
        self.tool = tool
        self.concurrency = max(1, concurrency)
        self.stop_event = threading.Event()
        self.active: dict[str, subprocess.Popen[Any] | None] = {}
        self.active_lock = threading.Lock()
        self.scheduler = threading.Thread(target=self._schedule, daemon=True)

    def start(self) -> None:
        """Recover interrupted jobs, then begin scheduling.

        Recovery runs first so a job left ``running`` by a crash is failed before
        the scheduler could otherwise report the queue as busy.
        """
        self.store.recover_interrupted_jobs()
        self.scheduler.start()

    def _schedule(self) -> None:
        while not self.stop_event.is_set():
            with self.active_lock:
                available = self.concurrency - len(self.active)
            if available > 0:
                for job_id in self.store.queued_job_ids(available):
                    claimed = self.store.claim_job(job_id)
                    # claim_job returns None if another pass won the race.
                    if claimed is not None:
                        with self.active_lock:
                            self.active[job_id] = None
                        threading.Thread(
                            target=self._run_job, args=(claimed,), daemon=True
                        ).start()
            # Polling rather than notifying: submissions arrive on other threads
            # and the latency budget here is seconds, not milliseconds.
            self.stop_event.wait(0.25)

    def _run_job(self, job: dict[str, Any]) -> None:
        job_id = job["jobId"]
        payload = job["payload"]
        command = job["command"]
        log_path = Path(payload["logPath"])
        done_path = Path(payload["donePath"])
        log_path.parent.mkdir(parents=True, exist_ok=True)
        # Clear any flag from a previous attempt so success is unambiguous.
        done_path.unlink(missing_ok=True)
        process: subprocess.Popen[Any] | None = None
        try:
            # Cancellation can land between claiming and starting.
            if self.store.is_cancel_requested(job_id):
                self.store.finish_job(job_id, "cancelled", None, "Job was cancelled")
                return
            with log_path.open("a", encoding="utf-8") as log_file:
                log_file.write(f"[job-runner] Starting {self.tool.name} job {job_id}\n")
                log_file.flush()
                process = subprocess.Popen(
                    command,
                    cwd=os.environ.get("RUNNER_WORK_DIR") or None,
                    env=self.tool.build_environment(payload),
                    stdin=subprocess.DEVNULL,
                    stdout=log_file,
                    stderr=subprocess.STDOUT,
                    # Its own session, so cancellation can signal the whole
                    # process group and reap grandchildren too.
                    start_new_session=True,
                    text=True,
                )
                with self.active_lock:
                    self.active[job_id] = process
                self.store.set_pid(job_id, process.pid)
                exit_code = process.wait()
                # Re-check: a cancel during the run makes exit status meaningless.
                cancelled = self.store.is_cancel_requested(job_id)
                if cancelled:
                    status = "cancelled"
                    error = "Job was cancelled"
                elif exit_code == 0:
                    status = "succeeded"
                    error = None
                    done_path.touch()
                else:
                    status = "failed"
                    error = f"Tool exited with status {exit_code}"
                log_file.write(
                    f"[job-runner] Job {job_id} finished with status {status}\n"
                )
                self.store.finish_job(job_id, status, exit_code, error)
        except Exception as error:  # noqa: BLE001 - persist unexpected worker errors
            # Never let a worker thread die silently: an un-finished job would be
            # polled forever by the webapp.
            self.store.finish_job(job_id, "failed", None, str(error))
        finally:
            with self.active_lock:
                self.active.pop(job_id, None)

    def cancel(self, job_id: str) -> dict[str, Any] | None:
        """Request cancellation and signal the process group if it is running."""
        job = self.store.request_cancel(job_id)
        if job is None or job["status"] in TERMINAL_STATUSES:
            return job
        with self.active_lock:
            process = self.active.get(job_id)
        if process is not None:
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                # Exited between the status read and the signal.
                pass
            threading.Thread(
                target=self._force_kill, args=(process,), daemon=True
            ).start()
        return self.store.get_job(job_id)

    @staticmethod
    def _force_kill(process: subprocess.Popen[Any]) -> None:
        """Escalate to SIGKILL if the group ignores SIGTERM."""
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

    def stop(self) -> None:
        """Stop scheduling and cancel everything still running."""
        self.stop_event.set()
        with self.active_lock:
            job_ids = list(self.active)
        for job_id in job_ids:
            self.cancel(job_id)
        # Guard against joining ourselves when stop() is reached from the
        # scheduler thread, and against a stop() that precedes start().
        if (
            self.scheduler.is_alive()
            and threading.current_thread() is not self.scheduler
        ):
            self.scheduler.join(timeout=2)
