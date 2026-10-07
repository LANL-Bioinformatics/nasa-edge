"""The tool extension point.

Applications subclass :class:`ToolDefinition` to describe how their own command
lines are built. The library never contains tool-specific knowledge; it only
calls into these methods.
"""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any

from .errors import RequestError

# Conservative identifier patterns. These bound values that reach a filesystem
# path or a command line, so they are allow-lists rather than deny-lists.
JOB_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
PROJECT_ID_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")


class ToolDefinition:
    """Base class describing how one tool is invoked.

    Subclasses must set :attr:`name` and implement :meth:`build_command`. The
    helpers below exist so that every subclass validates paths the same way;
    bypassing them reintroduces the path-traversal surface they close.

    :param allowed_roots: Directories submissions may reference. Any path
        outside them is rejected, which is what prevents a caller from pointing
        the runner at arbitrary files on the host.
    """

    #: Value of ``RUNNER_TOOL`` that selects this definition.
    name: str = ""

    #: Payload keys that must resolve inside ``allowed_roots`` for every
    #: submission. The executor requires ``logPath`` and ``donePath``.
    required_paths: tuple[str, ...] = ("logPath", "donePath")

    def __init__(self, allowed_roots: list[str]):
        if not self.name:
            raise ValueError(f"{type(self).__name__} must define a name")
        self.allowed_roots = [Path(root).resolve() for root in allowed_roots]

    # -- validation helpers -------------------------------------------------

    def within_roots(self, path: Path, extra_roots: list[Path] | None = None) -> bool:
        """Return True if ``path`` is inside an allowed root.

        Compares resolved paths, so ``..`` segments and symlinks cannot be used
        to escape.
        """
        roots = self.allowed_roots + list(extra_roots or [])
        return any(path == root or root in path.parents for root in roots)

    def path(
        self,
        payload: dict[str, Any],
        name: str,
        *,
        must_exist: bool = False,
        extra_roots: list[Path] | None = None,
    ) -> str:
        """Validate and normalize a required path from the payload.

        :raises RequestError: If missing, outside the allowed roots, or (when
            ``must_exist``) absent from disk.
        """
        value = payload.get(name)
        if not isinstance(value, str) or not value:
            raise RequestError(f"input.{name} is required")
        path = Path(value).resolve(strict=False)
        if not self.within_roots(path, extra_roots):
            raise RequestError(f"input.{name} is outside the allowed roots")
        if must_exist and not path.exists():
            raise RequestError(f"input.{name} does not exist")
        return str(path)

    def optional_path(
        self,
        payload: dict[str, Any],
        name: str,
        *,
        must_exist: bool = False,
        extra_roots: list[Path] | None = None,
    ) -> str | None:
        """Same as :meth:`path`, but ``None`` when the key is absent or empty."""
        value = payload.get(name)
        if value in (None, ""):
            return None
        return self.path(
            payload, name, must_exist=must_exist, extra_roots=extra_roots
        )

    @staticmethod
    def executable(env_var: str, default: str) -> str:
        """Resolve a tool executable from the environment.

        :raises RequestError: If configured empty, which would otherwise produce
            an argv whose first element is ``""``.
        """
        value = os.environ.get(env_var, default).strip()
        if not value:
            raise RequestError(f"{env_var} must not be empty")
        return value

    # -- subclass contract --------------------------------------------------

    def build_command(self, payload: dict[str, Any]) -> list[str]:
        """Return the argv to execute for a submission.

        Always an argument array, never a shell string: the payload contains
        caller-supplied paths, and a shell string would make them injectable.
        """
        raise NotImplementedError

    def validate_auxiliary_paths(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Return the payload with required paths validated and normalized.

        Called before :meth:`build_command`. Subclasses needing extra keys
        validated should extend :attr:`required_paths` rather than override this.
        """
        normalized = dict(payload)
        for name in self.required_paths:
            normalized[name] = self.path(payload, name)
        return normalized

    def build_environment(self, payload: dict[str, Any]) -> dict[str, str]:
        """Return the environment for the child process.

        Defaults to inheriting the runner's environment. Override to add
        variables a tool reads instead of accepting as arguments.
        """
        del payload  # unused in the default implementation
        return os.environ.copy()


class ToolRegistry:
    """Maps ``RUNNER_TOOL`` values onto :class:`ToolDefinition` subclasses."""

    def __init__(self, *definitions: type[ToolDefinition]):
        self._definitions: dict[str, type[ToolDefinition]] = {}
        for definition in definitions:
            self.register(definition)

    def register(self, definition: type[ToolDefinition]) -> None:
        if not definition.name:
            raise ValueError(f"{definition.__name__} must define a name")
        self._definitions[definition.name] = definition

    @property
    def names(self) -> list[str]:
        return sorted(self._definitions)

    def create(self, tool: str, allowed_roots: list[str]) -> ToolDefinition:
        """Instantiate the definition for ``tool``.

        :raises ValueError: If unknown. Raised at startup so a misconfigured
            ``RUNNER_TOOL`` fails immediately rather than on first submission.
        """
        definition = self._definitions.get((tool or "").strip().lower())
        if definition is None:
            expected = ", ".join(f"'{name}'" for name in self.names)
            raise ValueError(f"RUNNER_TOOL must be one of: {expected}")
        return definition(allowed_roots)
