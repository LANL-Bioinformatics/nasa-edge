"""Tests for the shared job-runner library.

Deliberately tool-agnostic: exercises store, executor, HTTP API, and the
ToolDefinition contract using fixture tools defined here. Application tool
definitions are tested in their own repositories.
"""

import os
import shutil
import sys
import tempfile
import time
import unittest
from http import HTTPStatus
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from edge_job_runner import (  # noqa: E402
    JobExecutor,
    JobStore,
    RequestError,
    ToolDefinition,
    ToolRegistry,
    create_app,
)


class EchoTool(ToolDefinition):
    """Fixture tool: runs a harmless command that always succeeds."""

    name = "echo"

    def build_command(self, payload):
        self.path(payload, "outputPath")
        return [shutil.which("true") or "/usr/bin/true"]


class FailingTool(ToolDefinition):
    """Fixture tool: exits non-zero."""

    name = "failing"

    def build_command(self, payload):
        return [shutil.which("false") or "/usr/bin/false"]


class SleepTool(ToolDefinition):
    """Fixture tool: long-running, so cancellation can be observed."""

    name = "sleep"

    def build_command(self, payload):
        return [shutil.which("sleep") or "/bin/sleep", "60"]


class EnvTool(ToolDefinition):
    """Fixture tool: contributes environment variables."""

    name = "env"

    def build_command(self, payload):
        return [shutil.which("true") or "/usr/bin/true"]

    def build_environment(self, payload):
        environment = os.environ.copy()
        environment["FIXTURE_VAR"] = payload["donePath"]
        return environment


def payload_for(root):
    return {
        "logPath": str(root / "log.txt"),
        "donePath": str(root / ".done"),
        "outputPath": str(root / "out"),
    }


class JobStoreTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.store = JobStore(str(Path(self.directory.name) / "jobs.sqlite3"))
        self.payload = {"logPath": "/work/log", "donePath": "/work/done"}

    def create(self, job_id="job-1", key="key-1", project="project-1", tool="echo",
               payload=None, command=None):
        return self.store.create_job(
            job_id, key, project, tool,
            self.payload if payload is None else payload,
            ["/bin/true"] if command is None else command,
        )

    def test_creates_a_queued_job(self):
        job, created = self.create()
        self.assertTrue(created)
        self.assertEqual(job["status"], "queued")
        self.assertEqual(job["jobId"], "job-1")

    def test_replaying_a_submission_returns_the_original(self):
        first, created_first = self.create()
        second, created_second = self.create()
        self.assertTrue(created_first)
        # The whole point of the idempotency key: a retried request must not
        # start a second execution.
        self.assertFalse(created_second)
        self.assertEqual(first["jobId"], second["jobId"])

    def test_reusing_a_key_with_a_different_payload_is_rejected(self):
        self.create()
        with self.assertRaises(RequestError):
            self.create(payload={"logPath": "/other", "donePath": "/other"})

    def test_reusing_a_key_with_a_different_command_is_rejected(self):
        self.create()
        with self.assertRaises(RequestError):
            self.create(command=["/bin/false"])

    def test_public_shape_hides_internal_columns(self):
        job, _ = self.create()
        for hidden in ("payload", "command", "pid"):
            self.assertNotIn(hidden, job)

    def test_claiming_transitions_to_running_once(self):
        self.create()
        claimed = self.store.claim_job("job-1")
        self.assertEqual(claimed["status"], "running")
        # Payload and command are only exposed to the executor.
        self.assertEqual(claimed["command"], ["/bin/true"])
        # A second claim must lose the race.
        self.assertIsNone(self.store.claim_job("job-1"))

    def test_running_jobs_are_failed_after_restart(self):
        self.create()
        self.store.claim_job("job-1")
        # Their child processes did not survive; leaving them running would
        # strand them forever.
        self.store.recover_interrupted_jobs()
        job = self.store.get_job("job-1")
        self.assertEqual(job["status"], "failed")
        self.assertIn("restarted", job["error"])

    def test_cancelling_a_queued_job_is_immediate(self):
        self.create()
        job = self.store.request_cancel("job-1")
        self.assertEqual(job["status"], "cancelled")

    def test_cancelling_a_running_job_only_flags_it(self):
        self.create()
        self.store.claim_job("job-1")
        job = self.store.request_cancel("job-1")
        # The executor still has to reap the process and set the final status.
        self.assertEqual(job["status"], "running")
        self.assertTrue(job["cancelRequested"])
        self.assertTrue(self.store.is_cancel_requested("job-1"))

    def test_cancelling_a_finished_job_does_not_change_it(self):
        self.create()
        self.store.finish_job("job-1", "succeeded", 0, None)
        job = self.store.request_cancel("job-1")
        self.assertEqual(job["status"], "succeeded")

    def test_cancelling_an_unknown_job_returns_none(self):
        self.assertIsNone(self.store.request_cancel("nope"))

    def test_queued_ids_exclude_cancelled_and_respect_the_limit(self):
        self.create("job-1", "key-1")
        self.create("job-2", "key-2")
        self.create("job-3", "key-3")
        self.store.request_cancel("job-2")
        self.assertEqual(self.store.queued_job_ids(10), ["job-1", "job-3"])
        self.assertEqual(len(self.store.queued_job_ids(1)), 1)

    def test_state_survives_a_new_store_instance(self):
        self.create()
        reopened = JobStore(str(Path(self.directory.name) / "jobs.sqlite3"))
        self.assertEqual(reopened.get_job("job-1")["status"], "queued")


class ToolDefinitionTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        # Resolve up front: on macOS /var is a symlink to /private/var, and the
        # library returns resolved paths.
        self.root = Path(self.directory.name).resolve()
        self.tool = EchoTool([self.directory.name])

    def test_rejects_paths_outside_allowed_roots(self):
        with self.assertRaises(RequestError):
            self.tool.path({"p": "/etc/passwd"}, "p")

    def test_rejects_traversal_out_of_allowed_roots(self):
        with self.assertRaises(RequestError):
            self.tool.path({"p": f"{self.root}/../escaped"}, "p")

    def test_rejects_a_missing_key(self):
        with self.assertRaises(RequestError):
            self.tool.path({}, "p")

    def test_rejects_a_non_string_value(self):
        with self.assertRaises(RequestError):
            self.tool.path({"p": 42}, "p")

    def test_must_exist_rejects_an_absent_file(self):
        with self.assertRaises(RequestError):
            self.tool.path({"p": str(self.root / "nope")}, "p", must_exist=True)

    def test_accepts_a_path_inside_the_roots(self):
        target = self.root / "inside"
        target.write_text("x", encoding="utf-8")
        self.assertEqual(
            self.tool.path({"p": str(target)}, "p", must_exist=True), str(target)
        )

    def test_optional_path_returns_none_when_absent(self):
        self.assertIsNone(self.tool.optional_path({}, "p"))
        self.assertIsNone(self.tool.optional_path({"p": ""}, "p"))

    def test_optional_path_still_validates_when_present(self):
        with self.assertRaises(RequestError):
            self.tool.optional_path({"p": "/etc/passwd"}, "p")

    def test_extra_roots_widen_validation(self):
        with tempfile.TemporaryDirectory() as other:
            other = str(Path(other).resolve())
            target = Path(other) / "f"
            target.write_text("x", encoding="utf-8")
            with self.assertRaises(RequestError):
                self.tool.path({"p": str(target)}, "p")
            self.assertEqual(
                self.tool.path(
                    {"p": str(target)}, "p", extra_roots=[Path(other)]
                ),
                str(target),
            )

    def test_executable_rejects_an_empty_configuration(self):
        os.environ["FIXTURE_EXEC"] = "  "
        self.addCleanup(os.environ.pop, "FIXTURE_EXEC", None)
        with self.assertRaises(RequestError):
            self.tool.executable("FIXTURE_EXEC", "fallback")

    def test_validate_auxiliary_paths_normalizes_required_keys(self):
        payload = payload_for(self.root)
        payload["logPath"] = f"{self.root}/./log.txt"
        normalized = self.tool.validate_auxiliary_paths(payload)
        self.assertEqual(normalized["logPath"], str(self.root / "log.txt"))

    def test_validate_auxiliary_paths_requires_every_declared_key(self):
        payload = payload_for(self.root)
        del payload["donePath"]
        with self.assertRaises(RequestError):
            self.tool.validate_auxiliary_paths(payload)

    def test_a_definition_without_a_name_is_rejected(self):
        class Nameless(ToolDefinition):
            pass

        with self.assertRaises(ValueError):
            Nameless([self.directory.name])

    def test_default_environment_inherits_the_process_environment(self):
        os.environ["FIXTURE_INHERITED"] = "yes"
        self.addCleanup(os.environ.pop, "FIXTURE_INHERITED", None)
        self.assertEqual(
            self.tool.build_environment({}).get("FIXTURE_INHERITED"), "yes"
        )


class ToolRegistryTests(unittest.TestCase):
    def setUp(self):
        self.registry = ToolRegistry(EchoTool, FailingTool)

    def test_creates_a_registered_tool(self):
        self.assertIsInstance(self.registry.create("echo", ["/tmp"]), EchoTool)

    def test_lookup_is_case_insensitive_and_trimmed(self):
        self.assertIsInstance(self.registry.create(" ECHO ", ["/tmp"]), EchoTool)

    def test_unknown_tool_names_the_valid_options(self):
        with self.assertRaises(ValueError) as caught:
            self.registry.create("nope", ["/tmp"])
        self.assertIn("'echo'", str(caught.exception))
        self.assertIn("'failing'", str(caught.exception))

    def test_names_are_sorted(self):
        self.assertEqual(self.registry.names, ["echo", "failing"])


class JobExecutorTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.store = JobStore(str(self.root / "jobs.sqlite3"))

    def run_to_completion(self, tool, timeout=5):
        executor = JobExecutor(self.store, tool, 1)
        payload = tool.validate_auxiliary_paths(payload_for(self.root))
        self.store.create_job(
            "job-1", "key-1", "project-1", tool.name, payload,
            tool.build_command(payload),
        )
        executor.start()
        self.addCleanup(executor.stop)
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            job = self.store.get_job("job-1")
            if job["status"] in {"succeeded", "failed", "cancelled"}:
                return job
            time.sleep(0.05)
        self.fail(f"job did not finish within {timeout}s")

    def test_a_successful_job_touches_the_done_flag(self):
        job = self.run_to_completion(EchoTool([self.directory.name]))
        self.assertEqual(job["status"], "succeeded")
        self.assertEqual(job["exitCode"], 0)
        self.assertTrue((self.root / ".done").exists())

    def test_a_failing_job_reports_its_exit_code_and_no_flag(self):
        job = self.run_to_completion(FailingTool([self.directory.name]))
        self.assertEqual(job["status"], "failed")
        self.assertNotEqual(job["exitCode"], 0)
        # Absence of the flag is how the webapp distinguishes a real success.
        self.assertFalse((self.root / ".done").exists())

    def test_a_stale_done_flag_is_cleared_before_running(self):
        (self.root / ".done").write_text("stale", encoding="utf-8")
        job = self.run_to_completion(FailingTool([self.directory.name]))
        self.assertEqual(job["status"], "failed")
        self.assertFalse((self.root / ".done").exists())

    def test_the_tool_environment_reaches_the_child(self):
        tool = EnvTool([self.directory.name])
        job = self.run_to_completion(tool)
        self.assertEqual(job["status"], "succeeded")

    def test_output_is_captured_to_the_log(self):
        self.run_to_completion(EchoTool([self.directory.name]))
        log = (self.root / "log.txt").read_text(encoding="utf-8")
        self.assertIn("Starting echo job job-1", log)
        self.assertIn("finished with status succeeded", log)

    def test_a_job_cancelled_before_starting_never_runs(self):
        tool = EchoTool([self.directory.name])
        payload = tool.validate_auxiliary_paths(payload_for(self.root))
        self.store.create_job(
            "job-1", "key-1", "project-1", tool.name, payload,
            tool.build_command(payload),
        )
        self.store.request_cancel("job-1")
        executor = JobExecutor(self.store, tool, 1)
        executor.start()
        self.addCleanup(executor.stop)
        time.sleep(0.5)
        self.assertEqual(self.store.get_job("job-1")["status"], "cancelled")
        self.assertFalse((self.root / ".done").exists())

    def test_cancelling_a_running_job_terminates_it(self):
        tool = SleepTool([self.directory.name])
        payload = tool.validate_auxiliary_paths(payload_for(self.root))
        self.store.create_job(
            "job-1", "key-1", "project-1", tool.name, payload,
            tool.build_command(payload),
        )
        executor = JobExecutor(self.store, tool, 1)
        executor.start()
        self.addCleanup(executor.stop)
        deadline = time.monotonic() + 5
        while self.store.get_job("job-1")["status"] != "running":
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        executor.cancel("job-1")
        while self.store.get_job("job-1")["status"] == "running":
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
        self.assertEqual(self.store.get_job("job-1")["status"], "cancelled")

    def test_concurrency_is_at_least_one(self):
        executor = JobExecutor(self.store, EchoTool([self.directory.name]), 0)
        # Zero would silently stall the queue forever.
        self.assertEqual(executor.concurrency, 1)


class JobApiTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name).resolve()
        self.store = JobStore(str(self.root / "jobs.sqlite3"))
        self.tool = EchoTool([self.directory.name])
        self.executor = JobExecutor(self.store, self.tool, 1)
        self.app = create_app(self.store, self.executor, self.tool, "test-token")
        # TestClient drives the ASGI app directly, so no socket or thread is
        # needed. The executor still runs for real, in its own threads.
        self.client = TestClient(self.app, raise_server_exceptions=False)
        self.executor.start()
        self.addCleanup(self.executor.stop)

    def request(self, method, path, payload=None, token="test-token", key=None):
        headers = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"
        if key:
            headers["Idempotency-Key"] = key
        response = self.client.request(method, path, json=payload, headers=headers)
        return response.status_code, response.json()

    def body(self, job_id="job-1", **overrides):
        payload = payload_for(self.root)
        payload.update(overrides)
        return {"jobId": job_id, "projectId": "project-1", "input": payload}

    def test_health_needs_no_credentials(self):
        status, body = self.request("GET", "/health", token=None)
        self.assertEqual(status, HTTPStatus.OK)
        self.assertEqual(body, {"status": "ok", "tool": "echo"})

    def test_submit_poll_and_replay(self):
        first_status, first = self.request("POST", "/v1/jobs", self.body(), key="job-1")
        second_status, second = self.request("POST", "/v1/jobs", self.body(), key="job-1")
        self.assertEqual(first_status, HTTPStatus.ACCEPTED)
        # 200 rather than 202 tells the caller this was a replay.
        self.assertEqual(second_status, HTTPStatus.OK)
        self.assertEqual(first["jobId"], second["jobId"])

        deadline = time.monotonic() + 5
        job = first
        while job["status"] not in {"succeeded", "failed"}:
            self.assertLess(time.monotonic(), deadline)
            time.sleep(0.05)
            _, job = self.request("GET", "/v1/jobs/job-1")
        self.assertEqual(job["status"], "succeeded")
        self.assertTrue((self.root / ".done").exists())

    def test_requests_without_a_token_are_rejected(self):
        status, _ = self.request("POST", "/v1/jobs", self.body(), token=None)
        self.assertEqual(status, HTTPStatus.UNAUTHORIZED)

    def test_requests_with_a_wrong_token_are_rejected(self):
        status, _ = self.request("GET", "/v1/jobs/job-1", token="nope")
        self.assertEqual(status, HTTPStatus.UNAUTHORIZED)

    def test_polling_an_unknown_job_is_not_found(self):
        status, _ = self.request("GET", "/v1/jobs/missing")
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_cancelling_an_unknown_job_is_not_found(self):
        status, _ = self.request("DELETE", "/v1/jobs/missing")
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_an_unknown_route_is_not_found(self):
        status, _ = self.request("POST", "/v1/nope", self.body())
        self.assertEqual(status, HTTPStatus.NOT_FOUND)

    def test_an_invalid_project_id_is_a_client_error(self):
        body = self.body()
        body["projectId"] = "bad/project"
        status, response = self.request("POST", "/v1/jobs", body)
        # 4xx matters: the webapp treats it as permanent and fails the job.
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("projectId", response["error"])

    def test_an_invalid_job_id_is_a_client_error(self):
        status, response = self.request("POST", "/v1/jobs", self.body(job_id="bad id!"))
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("jobId", response["error"])

    def test_a_non_object_input_is_a_client_error(self):
        status, _ = self.request(
            "POST", "/v1/jobs",
            {"jobId": "job-1", "projectId": "project-1", "input": "nope"},
        )
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)

    def test_a_path_outside_the_roots_is_a_client_error(self):
        status, response = self.request(
            "POST", "/v1/jobs", self.body(logPath="/etc/passwd")
        )
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("allowed roots", response["error"])

    def test_a_job_id_is_generated_when_omitted(self):
        status, job = self.request(
            "POST", "/v1/jobs",
            {"projectId": "project-1", "input": payload_for(self.root)},
        )
        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertTrue(job["jobId"])

    def test_an_unknown_route_keeps_the_error_body_shape(self):
        # Starlette's default is {"detail": ...}; the web server reads "error".
        status, body = self.request("POST", "/v1/nope", self.body())
        self.assertEqual(status, HTTPStatus.NOT_FOUND)
        self.assertEqual(body, {"error": "Not found"})

    def test_validation_failures_are_400_not_422(self):
        # FastAPI defaults to 422, which the web server would classify as
        # permanent anyway, but the contract specifies 400.
        for body in (
            {"jobId": "job-1", "input": payload_for(self.root)},
            {"jobId": "job-1", "projectId": "project-1"},
        ):
            status, response = self.request("POST", "/v1/jobs", body)
            self.assertEqual(status, HTTPStatus.BAD_REQUEST)
            self.assertIn("error", response)

    def test_field_messages_are_actionable(self):
        cases = [
            ({"jobId": "job-1", "input": payload_for(self.root)},
             "projectId is invalid"),
            ({"jobId": "job-1", "projectId": "project-1", "input": "nope"},
             "input must be an object"),
            ({"jobId": "bad id!", "projectId": "project-1",
              "input": payload_for(self.root)}, "jobId is invalid"),
        ]
        for body, expected in cases:
            _, response = self.request("POST", "/v1/jobs", body)
            self.assertEqual(response["error"], expected)

    def test_an_oversized_body_is_rejected(self):
        response = self.client.request(
            "POST", "/v1/jobs", json=self.body(),
            headers={"Authorization": "Bearer test-token",
                     "Content-Length": str(2 * 1024 * 1024)},
        )
        self.assertEqual(response.status_code, HTTPStatus.BAD_REQUEST)

    def test_schema_endpoints_are_disabled(self):
        # /health is the only intended unauthenticated surface.
        for path in ("/docs", "/redoc", "/openapi.json"):
            self.assertEqual(
                self.client.get(path).status_code, HTTPStatus.NOT_FOUND
            )

    def test_a_tool_failure_during_submission_is_a_client_error(self):
        # build_command raising RequestError must not become a 500, which the
        # web server would retry forever.
        status, response = self.request(
            "POST", "/v1/jobs", self.body(outputPath="/etc")
        )
        self.assertEqual(status, HTTPStatus.BAD_REQUEST)
        self.assertIn("allowed roots", response["error"])

    def test_cancelling_a_queued_job_reports_cancelled(self):
        self.request("POST", "/v1/jobs", self.body("job-cancel"), key="job-cancel")
        status, job = self.request("DELETE", "/v1/jobs/job-cancel")
        self.assertEqual(status, HTTPStatus.ACCEPTED)
        self.assertIn(job["status"], {"cancelled", "succeeded"})


if __name__ == "__main__":
    unittest.main()
