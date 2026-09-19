/**
 * ExecutionEngine — Unified Browser-Local Code Execution Engine
 * 
 * Manages local WebAssembly and Web Worker runtimes (Python via Pyodide, JavaScript/TypeScript workers),
 * provides timeout protection, infinite loop prevention, process cancellation, and truthful capability detection.
 */

import { ExecutionResult, LanguageRuntime, Problem } from "@/types/workspace";
import { StoredFile } from "@/lib/storage/workspaceStorage";

export interface ExecutionOptions {
  timeoutMs?: number;
  maxOutputBytes?: number;
  onStdout?: (chunk: string) => void;
  onStderr?: (chunk: string) => void;
}

export type SandboxMode =
  | "browser-sandbox"
  | "native-runtime"
  | "backend-temporary"
  | "unavailable";

export interface SandboxStatus {
  mode: SandboxMode;
  title: string;
  badgeClass: string;
  description: string;
  runtimes: string[];
}

export class ExecutionEngine {
  private activeWorker: Worker | null = null;
  private activeTimeoutTimer: any = null;
  private currentExecutionId: string | null = null;

  /**
   * Return truth-based availability list of compilers/runtimes.
   * NEVER claims a compiler is available if it cannot actually run.
   */
  getAvailableRuntimes(): LanguageRuntime[] {
    return [
      {
        id: "python",
        display_name: "Python (Browser WASM)",
        extensions: [".py"],
        runner: "Pyodide 0.26 WebAssembly",
        test_command: "unittest discover",
        available: true,
        version: "Python 3.12 (Pyodide WebAssembly)",
        build_required: false,
        install_hint: "Runs 100% locally inside your browser Web Worker.",
      },
      {
        id: "javascript",
        display_name: "JavaScript (Browser Worker)",
        extensions: [".js", ".mjs", ".cjs"],
        runner: "Isolated Web Worker",
        test_command: "node/worker runner",
        available: true,
        version: "ECMAScript 2024 (Browser Sandbox)",
        build_required: false,
        install_hint: "Runs locally inside an isolated Web Worker without DOM privileges.",
      },
      {
        id: "typescript",
        display_name: "TypeScript (Browser Sandbox)",
        extensions: [".ts", ".tsx"],
        runner: "Transpile + Isolated Worker",
        test_command: "worker runner",
        available: true,
        version: "TypeScript 5.x",
        build_required: false,
        install_hint: "Transpiles and executes inside the browser worker.",
      },
      {
        id: "cpp",
        display_name: "C++ (Native Compiler)",
        extensions: [".cpp", ".cc", ".cxx", ".h", ".hpp"],
        compiler: "gcc / clang",
        runner: "./a.out",
        available: false,
        build_required: true,
        install_hint: "C++ browser compiler unavailable. Connect the optional Solix Native Runtime for GCC/Clang.",
      },
      {
        id: "c",
        display_name: "C (Native Compiler)",
        extensions: [".c", ".h"],
        compiler: "gcc / clang",
        runner: "./a.out",
        available: false,
        build_required: true,
        install_hint: "C browser compiler unavailable. Connect the optional Solix Native Runtime for GCC/Clang.",
      },
      {
        id: "rust",
        display_name: "Rust (Native Toolchain)",
        extensions: [".rs"],
        compiler: "rustc / cargo",
        available: false,
        build_required: true,
        install_hint: "Rust browser compiler unavailable. Connect the optional Solix Native Runtime for cargo.",
      },
    ];
  }

  /**
   * Detect current sandbox status and primary runtime for the workspace.
   */
  getSandboxStatus(files: StoredFile[], activeFile: string | null): SandboxStatus {
    const runtime = this.detectRuntime(files, activeFile);

    if (runtime.id === "python" || runtime.id === "javascript" || runtime.id === "typescript") {
      return {
        mode: "browser-sandbox",
        title: "Browser Sandbox",
        badgeClass: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
        description: "Executing 100% locally in your browser via WebAssembly and Web Workers. Code never leaves your device.",
        runtimes: ["Python 3.12 (Pyodide WASM)", "JavaScript (Worker)", "TypeScript"],
      };
    }

    if (runtime.available) {
      return {
        mode: "native-runtime",
        title: "Native Runtime",
        badgeClass: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
        description: "Executing locally via connected Solix Native Runtime daemon.",
        runtimes: [runtime.display_name],
      };
    }

    return {
      mode: "unavailable",
      title: "Execution Unavailable",
      badgeClass: "bg-rose-500/15 text-rose-400 border-rose-500/30",
      description: `${runtime.display_name} cannot compile in the browser sandbox. Connect the optional Solix Native Runtime for native compilers.`,
      runtimes: [],
    };
  }

  /**
   * Automatically inspect project structure to identify primary runtime.
   */
  detectRuntime(files: StoredFile[], activeFile: string | null): LanguageRuntime {
    const runtimes = this.getAvailableRuntimes();

    // 1. Check active file extension
    if (activeFile) {
      const ext = "." + (activeFile.split(".").pop() || "").toLowerCase();
      const match = runtimes.find((r) => r.extensions.includes(ext));
      if (match) return match;
    }

    // 2. Check project structure
    const hasPy = files.some((f) => f.path.endsWith(".py") || f.path === "requirements.txt");
    if (hasPy) return runtimes.find((r) => r.id === "python")!;

    const hasTs = files.some((f) => f.path.endsWith(".ts") || f.path.endsWith(".tsx"));
    if (hasTs) return runtimes.find((r) => r.id === "typescript")!;

    const hasJs = files.some((f) => f.path.endsWith(".js") || f.path === "package.json");
    if (hasJs) return runtimes.find((r) => r.id === "javascript")!;

    const hasCpp = files.some((f) => f.path.endsWith(".cpp") || f.path.endsWith(".cc") || f.path === "CMakeLists.txt");
    if (hasCpp) return runtimes.find((r) => r.id === "cpp")!;

    const hasRust = files.some((f) => f.path.endsWith(".rs") || f.path === "Cargo.toml");
    if (hasRust) return runtimes.find((r) => r.id === "rust")!;

    // Default to python
    return runtimes.find((r) => r.id === "python")!;
  }

  /**
   * Run entry file in browser-local Web Worker.
   */
  async run(
    workspaceId: string,
    files: StoredFile[],
    entryFile: string | null,
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const runtime = this.detectRuntime(files, entryFile);

    if (!runtime.available) {
      const msg = `[Execution Error]: ${runtime.display_name} is not available in the browser sandbox.\n` +
                  `Solix does not fake execution output. To compile ${runtime.display_name}, connect the optional Solix Native Runtime.`;
      options.onStderr?.(msg + "\n");
      return {
        workspace_id: workspaceId,
        command: entryFile ? `run ${entryFile}` : "run",
        exit_code: 1,
        stdout: "",
        stderr: msg,
        execution_time: 0,
        timed_out: false,
        success: false,
        problems: [
          {
            severity: "error",
            file: entryFile || "",
            line: 1,
            column: 1,
            message: `${runtime.display_name} unavailable in browser sandbox`,
            source: "Solix",
          },
        ],
      };
    }

    return this.executeInWorker("run", workspaceId, runtime.id, files, entryFile, options);
  }

  /**
   * Run test suite in browser-local Web Worker.
   */
  async test(
    workspaceId: string,
    files: StoredFile[],
    options: ExecutionOptions = {}
  ): Promise<ExecutionResult> {
    const runtime = this.detectRuntime(files, null);

    if (!runtime.available) {
      const msg = `[Test Runner Error]: Testing for ${runtime.display_name} is unavailable in browser sandbox.`;
      options.onStderr?.(msg + "\n");
      return {
        workspace_id: workspaceId,
        command: "test",
        exit_code: 1,
        stdout: "",
        stderr: msg,
        execution_time: 0,
        timed_out: false,
        success: false,
      };
    }

    return this.executeInWorker("test", workspaceId, runtime.id, files, null, options);
  }

  /**
   * Stop active execution immediately by terminating the worker.
   */
  stop(): void {
    if (this.activeTimeoutTimer) {
      clearTimeout(this.activeTimeoutTimer);
      this.activeTimeoutTimer = null;
    }
    if (this.activeWorker) {
      try {
        this.activeWorker.terminate();
      } catch (_) {}
      this.activeWorker = null;
    }
    this.currentExecutionId = null;
  }

  /**
   * Internal worker execution orchestrator.
   */
  private executeInWorker(
    action: "run" | "test",
    workspaceId: string,
    runtimeId: string,
    files: StoredFile[],
    entryFile: string | null,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    this.stop(); // Terminate any existing worker

    const execId = crypto.randomUUID ? crypto.randomUUID() : `exec-${Date.now()}`;
    this.currentExecutionId = execId;
    const timeoutMs = options.timeoutMs || 15000;
    const maxOutputBytes = options.maxOutputBytes || 500 * 1024;

    const workerScript = runtimeId === "python" ? "/workers/python-worker.js" : "/workers/js-worker.js";

    return new Promise((resolve) => {
      let stdoutAccum = "";
      let stderrAccum = "";
      let timedOut = false;

      let worker: Worker;
      try {
        worker = new Worker(workerScript);
        this.activeWorker = worker;
      } catch (e: any) {
        const errStr = `[Worker Error]: Failed to spawn execution Web Worker: ${e.message || e}`;
        options.onStderr?.(errStr + "\n");
        return resolve({
          execution_id: execId,
          workspace_id: workspaceId,
          command: action === "test" ? "test" : entryFile || "main",
          exit_code: 1,
          stdout: "",
          stderr: errStr,
          execution_time: 0,
          timed_out: false,
          success: false,
        });
      }

      // Timeout watchdog
      this.activeTimeoutTimer = setTimeout(() => {
        timedOut = true;
        const timeoutMsg = `\n[Execution Timeout]: Process exceeded maximum allowed time limit (${timeoutMs / 1000}s) and was terminated.\n`;
        stderrAccum += timeoutMsg;
        options.onStderr?.(timeoutMsg);
        this.stop();
        resolve({
          execution_id: execId,
          workspace_id: workspaceId,
          command: action === "test" ? "test" : entryFile || "main",
          exit_code: 124,
          stdout: stdoutAccum,
          stderr: stderrAccum,
          execution_time: timeoutMs / 1000,
          timed_out: true,
          success: false,
          problems: [
            {
              severity: "error",
              file: entryFile || "",
              line: 1,
              column: 1,
              message: "Execution timed out (infinite loop protection triggered)",
              source: "Solix Sandbox",
            },
          ],
        });
      }, timeoutMs);

      worker.onmessage = (e) => {
        const msg = e.data;
        if (!msg) return;

        if (msg.type === "stdout" && msg.text) {
          if (stdoutAccum.length < maxOutputBytes) {
            stdoutAccum += msg.text;
            options.onStdout?.(msg.text);
          } else if (!stdoutAccum.endsWith("\n[Output truncated: maximum output size reached]\n")) {
            const truncMsg = "\n[Output truncated: maximum output size reached]\n";
            stdoutAccum += truncMsg;
            options.onStdout?.(truncMsg);
          }
        } else if (msg.type === "stderr" && msg.text) {
          if (stderrAccum.length < maxOutputBytes) {
            stderrAccum += msg.text;
            options.onStderr?.(msg.text);
          }
        } else if (msg.type === "completed") {
          if (this.activeTimeoutTimer) {
            clearTimeout(this.activeTimeoutTimer);
            this.activeTimeoutTimer = null;
          }
          this.activeWorker = null;
          this.currentExecutionId = null;

          const exitCode = msg.exitCode !== undefined ? msg.exitCode : 0;
          const execTime = msg.executionTime || 0;
          const problems = this.extractProblems(stderrAccum, files);

          resolve({
            execution_id: execId,
            workspace_id: workspaceId,
            command: action === "test" ? "test" : entryFile || "main",
            exit_code: exitCode,
            stdout: stdoutAccum,
            stderr: stderrAccum,
            execution_time: execTime,
            timed_out: false,
            success: exitCode === 0,
            problems,
          });
        }
      };

      worker.onerror = (err) => {
        if (this.activeTimeoutTimer) {
          clearTimeout(this.activeTimeoutTimer);
          this.activeTimeoutTimer = null;
        }
        this.activeWorker = null;
        this.currentExecutionId = null;

        const errText = `\n[Worker Exception]: ${err.message || "Unknown worker error"}\n`;
        stderrAccum += errText;
        options.onStderr?.(errText);

        resolve({
          execution_id: execId,
          workspace_id: workspaceId,
          command: action === "test" ? "test" : entryFile || "main",
          exit_code: 1,
          stdout: stdoutAccum,
          stderr: stderrAccum,
          execution_time: 0,
          timed_out: false,
          success: false,
        });
      };

      // Send execution payload to worker
      worker.postMessage({
        action,
        id: execId,
        entryFile,
        files: files.map((f) => ({ path: f.path, content: f.content })),
      });
    });
  }

  /**
   * Parse compiler/runtime errors from stderr into structured Problems.
   */
  private extractProblems(stderr: string, files: StoredFile[]): Problem[] {
    const problems: Problem[] = [];
    if (!stderr) return problems;

    // Python traceback matcher: File "...", line X
    const pyRegex = /File ["'](?:(?:\/workspace\/)?([^"']+))["'], line (\d+)(?:, in .*)?\n(?:\s+.*\n)?(?:(\w+Error|Exception): (.*))?/g;
    let match: RegExpExecArray | null;

    while ((match = pyRegex.exec(stderr)) !== null) {
      const file = match[1].replace(/^\/workspace\//, "");
      const line = parseInt(match[2], 10) || 1;
      const errorType = match[3] || "RuntimeError";
      const errorMsg = match[4] ? `${errorType}: ${match[4].trim()}` : errorType;

      problems.push({
        severity: "error",
        file,
        line,
        column: 1,
        message: errorMsg,
        source: "Python",
      });
    }

    // JS error matcher: at ... (file:line:col)
    const jsRegex = /(?:(\w+Error): (.*)\n\s+at .*\((?:.*\/)?([^):]+):(\d+):(\d+)\))/g;
    while ((match = jsRegex.exec(stderr)) !== null) {
      problems.push({
        severity: "error",
        file: match[3],
        line: parseInt(match[4], 10) || 1,
        column: parseInt(match[5], 10) || 1,
        message: `${match[1]}: ${match[2]}`,
        source: "JavaScript",
      });
    }

    return problems;
  }
}

export const executionEngine = new ExecutionEngine();

