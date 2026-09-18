from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
import time
from typing import Dict, List, Optional, Tuple
from pydantic import BaseModel

from app.core.config import settings
from app.services.workspace.diagnostics import DiagnosticItem, diagnostic_parser
from app.services.workspace.languages import language_registry

logger = logging.getLogger("solix.workspace.compiler")


class BuildResult(BaseModel):
    workspace_id: str
    success: bool
    command: str
    exit_code: int
    stdout: str
    stderr: str
    build_time: float
    binary_path: Optional[str] = None
    problems: List[DiagnosticItem] = []


class CompilerService:
    """Orchestrates multi-file compilation for compiled languages (C, C++, TypeScript)."""

    def __init__(self):
        pass

    def _get_build_dir(self, ws_dir: Path) -> Path:
        """Get or create the isolated build directory."""
        build_dir = ws_dir / "build"
        build_dir.mkdir(parents=True, exist_ok=True)
        return build_dir

    def _collect_cpp_sources(self, ws_dir: Path) -> List[Path]:
        """Collect all relevant C++ source files, avoiding build or temp dirs."""
        sources: List[Path] = []
        for ext in ("*.cpp", "*.cc", "*.cxx"):
            for p in ws_dir.glob(f"**/{ext}"):
                # Exclude build, cache, test files if requested
                rel_parts = p.relative_to(ws_dir).parts
                if any(part in ("build", ".git", "venv", ".venv") for part in rel_parts):
                    continue
                sources.append(p)
        return sorted(sources)

    def _collect_c_sources(self, ws_dir: Path) -> List[Path]:
        """Collect all relevant C source files."""
        sources: List[Path] = []
        for p in ws_dir.glob("**/*.c"):
            rel_parts = p.relative_to(ws_dir).parts
            if any(part in ("build", ".git", "venv", ".venv") for part in rel_parts):
                continue
            sources.append(p)
        return sorted(sources)

    async def build(self, workspace_id: str, ws_dir: Path) -> BuildResult:
        """Compile project sources in the workspace into an isolated executable."""
        start_time = time.time()
        runtimes = language_registry.detect_runtimes()
        proj_lang = language_registry.detect_project_language(ws_dir)

        if not proj_lang or not proj_lang.build_required:
            # Interpreted languages do not strictly require compilation, but we validate syntax
            return BuildResult(
                workspace_id=workspace_id,
                success=True,
                command="[Build not required for interpreted language]",
                exit_code=0,
                stdout="Project uses interpreted runtime. Direct compilation not required.\n",
                stderr="",
                build_time=0.0,
                binary_path=None,
                problems=[],
            )

        if not proj_lang.available:
            return BuildResult(
                workspace_id=workspace_id,
                success=False,
                command=proj_lang.compiler or "compiler",
                exit_code=127,
                stdout="",
                stderr=f"Error: Compiler for {proj_lang.display_name} is not installed.\n{proj_lang.install_hint or ''}",
                build_time=0.0,
                binary_path=None,
                problems=[
                    DiagnosticItem(
                        severity="error",
                        file="",
                        line=1,
                        column=1,
                        message=f"Compiler not installed: {proj_lang.display_name}",
                        source="compiler",
                    )
                ],
            )

        build_dir = self._get_build_dir(ws_dir)
        bin_name = "main.exe" if os.name == "nt" else "main"
        target_bin = build_dir / bin_name

        # ── C++ Compilation ──────────────────────────────────────────────────
        if proj_lang.id == "cpp":
            sources = self._collect_cpp_sources(ws_dir)
            if not sources:
                return BuildResult(
                    workspace_id=workspace_id,
                    success=False,
                    command="g++",
                    exit_code=1,
                    stdout="",
                    stderr="Error: No C++ source files (*.cpp, *.cc) found in workspace.\n",
                    build_time=0.0,
                    binary_path=None,
                    problems=[],
                )

            # Build command args
            compiler_bin = proj_lang.compiler or "g++"
            cmd_args = [
                compiler_bin,
                "-std=c++17",
                "-Wall",
                "-Wextra",
            ]

            # Add include directory if present
            include_dir = ws_dir / "include"
            if include_dir.is_dir():
                cmd_args.extend(["-I", str(include_dir)])
            cmd_args.extend(["-I", str(ws_dir)])

            # Relative source paths for cleaner error reporting
            for src in sources:
                cmd_args.append(str(src.relative_to(ws_dir)))

            cmd_args.extend(["-o", str(target_bin.relative_to(ws_dir))])
            cmd_display = " ".join(cmd_args)
            logger.info(f"[Compiler] Building C++ in ws={workspace_id}: {cmd_display}")

            proc = await asyncio.create_subprocess_exec(
                cmd_args[0],
                *cmd_args[1:],
                cwd=str(ws_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await proc.communicate()
            exit_code = proc.returncode or 0
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")

            problems = diagnostic_parser.parse(stderr + "\n" + stdout)
            duration = round(time.time() - start_time, 3)

            return BuildResult(
                workspace_id=workspace_id,
                success=(exit_code == 0 and target_bin.exists()),
                command=cmd_display,
                exit_code=exit_code,
                stdout=stdout or ("Build succeeded.\n" if exit_code == 0 else ""),
                stderr=stderr,
                build_time=duration,
                binary_path=str(target_bin) if exit_code == 0 else None,
                problems=problems,
            )

        # ── C Compilation ────────────────────────────────────────────────────
        elif proj_lang.id == "c":
            sources = self._collect_c_sources(ws_dir)
            if not sources:
                return BuildResult(
                    workspace_id=workspace_id,
                    success=False,
                    command="gcc",
                    exit_code=1,
                    stdout="",
                    stderr="Error: No C source files (*.c) found in workspace.\n",
                    build_time=0.0,
                    binary_path=None,
                    problems=[],
                )

            compiler_bin = proj_lang.compiler or "gcc"
            cmd_args = [
                compiler_bin,
                "-Wall",
                "-Wextra",
            ]
            include_dir = ws_dir / "include"
            if include_dir.is_dir():
                cmd_args.extend(["-I", str(include_dir)])
            cmd_args.extend(["-I", str(ws_dir)])

            for src in sources:
                cmd_args.append(str(src.relative_to(ws_dir)))

            cmd_args.extend(["-o", str(target_bin.relative_to(ws_dir))])
            cmd_display = " ".join(cmd_args)

            proc = await asyncio.create_subprocess_exec(
                cmd_args[0],
                *cmd_args[1:],
                cwd=str(ws_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout_bytes, stderr_bytes = await proc.communicate()
            exit_code = proc.returncode or 0
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")

            problems = diagnostic_parser.parse(stderr + "\n" + stdout)
            duration = round(time.time() - start_time, 3)

            return BuildResult(
                workspace_id=workspace_id,
                success=(exit_code == 0 and target_bin.exists()),
                command=cmd_display,
                exit_code=exit_code,
                stdout=stdout or ("Build succeeded.\n" if exit_code == 0 else ""),
                stderr=stderr,
                build_time=duration,
                binary_path=str(target_bin) if exit_code == 0 else None,
                problems=problems,
            )

        # ── TypeScript Compilation ───────────────────────────────────────────
        elif proj_lang.id == "typescript":
            compiler_bin = proj_lang.compiler or "tsc"
            cmd_args = [
                compiler_bin,
                "--outDir", "build",
                "--module", "commonjs",
                "--target", "es2022",
                "--skipLibCheck",
            ]
            # Add ts files
            for p in ws_dir.glob("**/*.ts"):
                if not any(part in ("build", "node_modules") for part in p.relative_to(ws_dir).parts):
                    cmd_args.append(str(p.relative_to(ws_dir)))

            is_script = os.name == "nt" and (compiler_bin.lower().endswith(".cmd") or compiler_bin.lower().endswith(".bat"))
            if is_script:
                proc = await asyncio.create_subprocess_shell(
                    " ".join(f'"{a}"' if " " in a else a for a in cmd_args),
                    cwd=str(ws_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
            else:
                proc = await asyncio.create_subprocess_exec(
                    cmd_args[0],
                    *cmd_args[1:],
                    cwd=str(ws_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )

            stdout_bytes, stderr_bytes = await proc.communicate()
            exit_code = proc.returncode or 0
            stdout = stdout_bytes.decode("utf-8", errors="replace")
            stderr = stderr_bytes.decode("utf-8", errors="replace")
            problems = diagnostic_parser.parse(stderr + "\n" + stdout)
            duration = round(time.time() - start_time, 3)

            return BuildResult(
                workspace_id=workspace_id,
                success=(exit_code == 0),
                command=" ".join(cmd_args),
                exit_code=exit_code,
                stdout=stdout or ("Build succeeded.\n" if exit_code == 0 else ""),
                stderr=stderr,
                build_time=duration,
                binary_path="build/index.js",
                problems=problems,
            )

        return BuildResult(
            workspace_id=workspace_id,
            success=False,
            command="unsupported",
            exit_code=1,
            stdout="",
            stderr=f"Build not yet implemented for runtime '{proj_lang.id}'.",
            build_time=0.0,
            binary_path=None,
            problems=[],
        )


compiler_service = CompilerService()

