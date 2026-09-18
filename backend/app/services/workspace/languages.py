from __future__ import annotations

import logging
import os
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Dict, List, Optional
from pydantic import BaseModel

logger = logging.getLogger("solix.workspace.languages")

TOOLCHAINS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "toolchains"
W64DEVKIT_BIN = TOOLCHAINS_DIR / "w64devkit" / "bin"


class LanguageRuntime(BaseModel):
    id: str
    display_name: str
    extensions: List[str]
    compiler: Optional[str] = None
    runner: Optional[str] = None
    test_command: Optional[str] = None
    available: bool = False
    version: Optional[str] = None
    build_required: bool = False
    install_hint: Optional[str] = None


def _find_executable(name: str, extra_dirs: Optional[List[Path]] = None) -> Optional[Path]:
    """Find an executable in extra toolchain dirs first, then system PATH."""
    if extra_dirs:
        for d in extra_dirs:
            p = d / (name if name.endswith(".exe") or os.name != "nt" else f"{name}.exe")
            if p.is_file() and os.access(p, os.X_OK):
                return p
    found = shutil.which(name)
    return Path(found) if found else None


def _get_version(cmd: List[str]) -> Optional[str]:
    """Safely get the first line of version output from an executable."""
    try:
        is_script = os.name == "nt" and (str(cmd[0]).lower().endswith(".cmd") or str(cmd[0]).lower().endswith(".bat"))
        res = subprocess.run(
            cmd,
            shell=is_script,
            capture_output=True,
            text=True,
            timeout=3,
            env=os.environ,
        )
        out = (res.stdout or res.stderr or "").strip()
        if out:
            return out.splitlines()[0][:60]
    except Exception as e:
        logger.debug(f"Failed to check version for {cmd}: {e}")
    return None


class LanguageRegistry:
    """Registry of supported programming languages and their host compilers/runtimes."""

    def __init__(self):
        self._cache: Optional[Dict[str, LanguageRuntime]] = None

    def detect_runtimes(self, force_refresh: bool = False) -> Dict[str, LanguageRuntime]:
        """Detect real availability and versions of all supported programming languages."""
        if self._cache and not force_refresh:
            return self._cache

        runtimes: Dict[str, LanguageRuntime] = {}
        extra_dirs = [W64DEVKIT_BIN] if W64DEVKIT_BIN.is_dir() else []

        # 1. Python
        python_bin = sys.executable
        py_ver = _get_version([python_bin, "--version"]) or f"Python {sys.version.split()[0]}"
        runtimes["python"] = LanguageRuntime(
            id="python",
            display_name="Python",
            extensions=[".py"],
            compiler=None,
            runner=python_bin,
            test_command=f"{python_bin} -m unittest discover -s . -p \"test_*.py\"",
            available=True,
            version=py_ver,
            build_required=False,
            install_hint="Python is already installed.",
        )

        # 2. Node.js / JavaScript
        node_bin = _find_executable("node")
        node_ver = _get_version([str(node_bin), "--version"]) if node_bin else None
        runtimes["javascript"] = LanguageRuntime(
            id="javascript",
            display_name="JavaScript (Node.js)",
            extensions=[".js", ".mjs", ".cjs"],
            compiler=None,
            runner=str(node_bin) if node_bin else "node",
            test_command="npm test" if _find_executable("npm") else "node --test",
            available=bool(node_bin),
            version=f"Node.js {node_ver}" if node_ver else None,
            build_required=False,
            install_hint="Install Node.js via 'winget install OpenJS.NodeJS' or https://nodejs.org",
        )

        # 3. TypeScript
        # Look for local tsc in frontend/node_modules/.bin or system
        fe_tsc = Path(__file__).resolve().parent.parent.parent.parent.parent / "frontend" / "node_modules" / ".bin" / ("tsc.cmd" if os.name == "nt" else "tsc")
        tsc_bin = fe_tsc if fe_tsc.is_file() else _find_executable("tsc")
        tsc_ver = _get_version([str(tsc_bin), "--version"]) if tsc_bin else None
        runtimes["typescript"] = LanguageRuntime(
            id="typescript",
            display_name="TypeScript",
            extensions=[".ts", ".tsx"],
            compiler=str(tsc_bin) if tsc_bin else "tsc",
            runner=str(node_bin) if node_bin else "node",
            test_command="npm test",
            available=bool(tsc_bin and node_bin),
            version=tsc_ver,
            build_required=True,
            install_hint="Run 'npm install typescript -g' or use project node_modules.",
        )

        # 4. C++ (G++)
        gpp_bin = _find_executable("g++", extra_dirs=extra_dirs)
        gpp_ver = _get_version([str(gpp_bin), "--version"]) if gpp_bin else None
        runtimes["cpp"] = LanguageRuntime(
            id="cpp",
            display_name="C++ (GCC/G++)",
            extensions=[".cpp", ".cc", ".cxx", ".hpp", ".h"],
            compiler=str(gpp_bin) if gpp_bin else "g++",
            runner="./main.exe" if os.name == "nt" else "./main",
            test_command=None,
            available=bool(gpp_bin),
            version=gpp_ver,
            build_required=True,
            install_hint="Install MinGW-w64 via 'winget install MSYS2.MSYS2' or w64devkit.",
        )

        # 5. C (GCC)
        gcc_bin = _find_executable("gcc", extra_dirs=extra_dirs)
        gcc_ver = _get_version([str(gcc_bin), "--version"]) if gcc_bin else None
        runtimes["c"] = LanguageRuntime(
            id="c",
            display_name="C (GCC)",
            extensions=[".c", ".h"],
            compiler=str(gcc_bin) if gcc_bin else "gcc",
            runner="./main.exe" if os.name == "nt" else "./main",
            test_command=None,
            available=bool(gcc_bin),
            version=gcc_ver,
            build_required=True,
            install_hint="Install GCC via 'winget install MSYS2.MSYS2' or w64devkit.",
        )

        # 6. Rust
        rustc_bin = _find_executable("rustc")
        cargo_bin = _find_executable("cargo")
        rust_ver = _get_version([str(rustc_bin), "--version"]) if rustc_bin else None
        runtimes["rust"] = LanguageRuntime(
            id="rust",
            display_name="Rust",
            extensions=[".rs"],
            compiler=str(rustc_bin) if rustc_bin else "rustc",
            runner=str(cargo_bin) if cargo_bin else "./main.exe",
            test_command="cargo test" if cargo_bin else None,
            available=bool(rustc_bin),
            version=rust_ver,
            build_required=True,
            install_hint="Install Rust via 'winget install Rustlang.Rustup' or https://rustup.rs",
        )

        # 7. Go
        go_bin = _find_executable("go")
        go_ver = _get_version([str(go_bin), "version"]) if go_bin else None
        runtimes["go"] = LanguageRuntime(
            id="go",
            display_name="Go",
            extensions=[".go"],
            compiler=str(go_bin) if go_bin else "go",
            runner=f"{go_bin} run ." if go_bin else "go run .",
            test_command=f"{go_bin} test ./..." if go_bin else "go test ./...",
            available=bool(go_bin),
            version=go_ver,
            build_required=True,
            install_hint="Install Go via 'winget install GoLang.Go' or https://go.dev",
        )

        # 8. Java
        javac_bin = _find_executable("javac")
        java_bin = _find_executable("java")
        java_ver = _get_version([str(java_bin), "-version"]) if java_bin else None
        runtimes["java"] = LanguageRuntime(
            id="java",
            display_name="Java",
            extensions=[".java"],
            compiler=str(javac_bin) if javac_bin else "javac",
            runner=str(java_bin) if java_bin else "java",
            test_command=None,
            available=bool(javac_bin and java_bin),
            version=java_ver,
            build_required=True,
            install_hint="Install JDK via 'winget install Oracle.JDK.21' or https://adoptium.net",
        )

        self._cache = runtimes
        return runtimes

    def detect_project_language(self, workspace_dir: Path) -> Optional[LanguageRuntime]:
        """Infer the primary language runtime for a given workspace directory."""
        runtimes = self.detect_runtimes()

        # Check configuration files first
        if (workspace_dir / "Cargo.toml").exists():
            return runtimes["rust"]
        if (workspace_dir / "go.mod").exists():
            return runtimes["go"]
        if (workspace_dir / "package.json").exists():
            if (workspace_dir / "tsconfig.json").exists() or any(workspace_dir.glob("**/*.ts")):
                return runtimes["typescript"]
            return runtimes["javascript"]
        if (workspace_dir / "pom.xml").exists() or (workspace_dir / "build.gradle").exists():
            return runtimes["java"]
        if (workspace_dir / "Makefile").exists() or (workspace_dir / "CMakeLists.txt").exists():
            if any(workspace_dir.glob("**/*.cpp")) or any(workspace_dir.glob("**/*.cc")):
                return runtimes["cpp"]
            return runtimes["c"]

        # Check primary entry point or file extensions
        if (workspace_dir / "main.cpp").exists() or (workspace_dir / "src" / "main.cpp").exists() or any(workspace_dir.glob("*.cpp")):
            return runtimes["cpp"]
        if (workspace_dir / "main.c").exists() or (workspace_dir / "src" / "main.c").exists() or any(workspace_dir.glob("*.c")):
            return runtimes["c"]
        if (workspace_dir / "index.ts").exists() or (workspace_dir / "src" / "index.ts").exists() or any(workspace_dir.glob("*.ts")):
            return runtimes["typescript"]
        if (workspace_dir / "main.py").exists() or (workspace_dir / "app.py").exists() or any(workspace_dir.glob("*.py")):
            return runtimes["python"]
        if (workspace_dir / "index.js").exists() or (workspace_dir / "main.js").exists() or any(workspace_dir.glob("*.js")):
            return runtimes["javascript"]
        if (workspace_dir / "Main.java").exists() or any(workspace_dir.glob("*.java")):
            return runtimes["java"]
        if (workspace_dir / "main.go").exists() or any(workspace_dir.glob("*.go")):
            return runtimes["go"]
        if (workspace_dir / "main.rs").exists() or (workspace_dir / "src" / "main.rs").exists() or any(workspace_dir.glob("*.rs")):
            return runtimes["rust"]

        return None


language_registry = LanguageRegistry()
