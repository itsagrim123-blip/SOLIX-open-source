/**
 * python-worker.js — Isolated Web Worker running Pyodide WebAssembly
 * 
 * Provides genuine in-browser Python execution with:
 * - Multi-file virtual filesystem (/workspace)
 * - sys.stdout and sys.stderr interception with real-time streaming
 * - Unittest test runner support
 * - Clean process exit codes and execution timing
 */

let pyodide = null;
let isInitializing = false;
let initPromise = null;

async function getPyodide() {
  if (pyodide) return pyodide;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    self.postMessage({ type: "stdout", text: "[Python WASM]: Initializing Pyodide runtime in Web Worker...\n" });
    try {
      importScripts("https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js");
      pyodide = await self.loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
      // Setup workspace directory
      try {
        pyodide.FS.mkdir("/workspace");
      } catch (e) {
        // already exists
      }
      self.postMessage({ type: "stdout", text: "[Python WASM]: Runtime ready.\n" });
      return pyodide;
    } catch (err) {
      self.postMessage({
        type: "stderr",
        text: `[Python WASM Error]: Failed to initialize WebAssembly Python runtime: ${err.message || err}\n` +
              `Please ensure you have an active internet connection to load the Pyodide WebAssembly runtime.\n`,
      });
      throw err;
    }
  })();

  return initPromise;
}

function syncFilesToPyodide(py, files) {
  // Clear existing workspace files
  try {
    const entries = py.FS.readdir("/workspace");
    for (const entry of entries) {
      if (entry !== "." && entry !== "..") {
        try {
          const stat = py.FS.stat("/workspace/" + entry);
          if (py.FS.isDir(stat.mode)) {
            // Recursive rm could be added if needed
          } else {
            py.FS.unlink("/workspace/" + entry);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  // Write all current workspace files
  for (const f of files) {
    const cleanPath = f.path.replace(/^[/\\]+/, "");
    const parts = cleanPath.split("/").filter(Boolean);

    // Ensure subdirectories exist
    let currentDir = "/workspace";
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir += "/" + parts[i];
      try {
        py.FS.mkdir(currentDir);
      } catch (_) {}
    }

    const targetPath = "/workspace/" + cleanPath;
    try {
      py.FS.writeFile(targetPath, f.content || "");
    } catch (e) {
      console.warn("Failed to write to virtual FS:", targetPath, e);
    }
  }
}

self.onmessage = async (event) => {
  const { action, entryFile, files, id } = event.data;

  if (action === "run" || action === "test") {
    const startTime = performance.now();
    let exitCode = 0;
    let stdoutBuffer = "";
    let stderrBuffer = "";

    try {
      const py = await getPyodide();

      // Configure stdout and stderr handlers
      py.setStdout({
        batched: (str) => {
          stdoutBuffer += str + "\n";
          self.postMessage({ type: "stdout", text: str + "\n" });
        },
      });

      py.setStderr({
        batched: (str) => {
          stderrBuffer += str + "\n";
          self.postMessage({ type: "stderr", text: str + "\n" });
        },
      });

      // Sync project files
      syncFilesToPyodide(py, files || []);

      if (action === "run") {
        const targetEntry = entryFile || "main.py";
        const script = `
import sys
import os

if "/workspace" not in sys.path:
    sys.path.insert(0, "/workspace")

os.chdir("/workspace")

entry_file = "${targetEntry}"
if not os.path.exists(entry_file):
    raise FileNotFoundError(f"Entry file '{entry_file}' not found in workspace.")

with open(entry_file, "r", encoding="utf-8") as f:
    code = f.read()

# Execute entry script in __main__ namespace
globals_dict = {"__name__": "__main__", "__file__": os.path.abspath(entry_file)}
exec(compile(code, entry_file, "exec"), globals_dict)
`;
        await py.runPythonAsync(script);
      } else if (action === "test") {
        const testScript = `
import sys
import os
import unittest

if "/workspace" not in sys.path:
    sys.path.insert(0, "/workspace")

os.chdir("/workspace")

# Discover and run unittests
loader = unittest.TestLoader()
suite = loader.discover("/workspace", pattern="test_*.py")
runner = unittest.TextTestRunner(verbosity=2)
result = runner.run(suite)

if not result.wasSuccessful():
    sys.exit(1)
`;
        await py.runPythonAsync(testScript);
      }
    } catch (err) {
      exitCode = 1;
      const errMsg = (err.message || String(err)).replace(/\r/g, "");
      stderrBuffer += errMsg + "\n";
      self.postMessage({ type: "stderr", text: errMsg + "\n" });
    } finally {
      const execTime = ((performance.now() - startTime) / 1000).toFixed(3);
      self.postMessage({
        type: "completed",
        id,
        exitCode,
        executionTime: parseFloat(execTime),
        stdout: stdoutBuffer,
        stderr: stderrBuffer,
      });
    }
  }
};

