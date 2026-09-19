/**
 * js-worker.js — Isolated Web Worker for JavaScript and TypeScript execution
 * 
 * Runs code in a clean sandboxed worker without DOM or window privileges.
 * Intercepts console output and reports execution time, exit codes, and errors.
 */

self.onmessage = async (event) => {
  const { action, entryFile, files, id } = event.data;
  const startTime = performance.now();
  let exitCode = 0;
  let stdoutBuffer = "";
  let stderrBuffer = "";

  // Override console methods
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = (...args) => {
    const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
    stdoutBuffer += line + "\n";
    self.postMessage({ type: "stdout", text: line + "\n" });
  };

  console.warn = (...args) => {
    const line = "[warn] " + args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
    stdoutBuffer += line + "\n";
    self.postMessage({ type: "stdout", text: line + "\n" });
  };

  console.error = (...args) => {
    const line = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
    stderrBuffer += line + "\n";
    self.postMessage({ type: "stderr", text: line + "\n" });
  };

  try {
    const targetFile = entryFile || "index.js";
    const fileObj = (files || []).find((f) => f.path === targetFile || f.path === `./${targetFile}`);
    if (!fileObj) {
      throw new Error(`Entry file '${targetFile}' not found in workspace.`);
    }

    // Build virtual module loader for multi-file JS
    const moduleMap = new Map();
    for (const f of files || []) {
      moduleMap.set(f.path, f.content);
      moduleMap.set("./" + f.path, f.content);
      const noExt = f.path.replace(/\.[^/.]+$/, "");
      moduleMap.set(noExt, f.content);
      moduleMap.set("./" + noExt, f.content);
    }

    // Simple CommonJS-like require
    const virtualRequire = (modPath) => {
      if (moduleMap.has(modPath)) {
        const modCode = moduleMap.get(modPath);
        const module = { exports: {} };
        const fn = new Function("require", "module", "exports", modCode);
        fn(virtualRequire, module, module.exports);
        return module.exports;
      }
      throw new Error(`Cannot find module '${modPath}' in local workspace.`);
    };

    // Execute target code
    const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
    const runFn = new AsyncFunction("require", "console", fileObj.content);
    await runFn(virtualRequire, console);
  } catch (err) {
    exitCode = 1;
    const errText = err.stack || err.message || String(err);
    stderrBuffer += errText + "\n";
    self.postMessage({ type: "stderr", text: errText + "\n" });
  } finally {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;

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
};

