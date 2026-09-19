/**
 * WebPreviewBuilder — 100% Local-First Web Development Pipeline
 * 
 * Provides truthful HTML/CSS/JS validation, multi-file virtual asset resolution,
 * sandboxed preview snapshot building, and iframe console/runtime error capture.
 */

import { Problem, WebBuildResult } from "@/types/workspace";
import { StoredFile } from "@/lib/storage/workspaceStorage";

export interface PreviewSnapshot {
  html: string;
  blobUrls: string[];
  cleanup: () => void;
}

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\//, "");
}

function findLineAndColumn(content: string, substring: string): { line: number; column: number } {
  const index = content.indexOf(substring);
  if (index === -1) return { line: 1, column: 1 };
  const lines = content.slice(0, index).split("\n");
  const line = lines.length;
  const column = lines[lines.length - 1].length + 1;
  return { line, column };
}

export class WebPreviewBuilder {
  private activeBlobUrls: Set<string> = new Set();

  /**
   * Determine if a project qualifies as a Web Project.
   * True if project contains index.html or any .html file.
   */
  isWebProject(files: StoredFile[]): boolean {
    return files.some(
      (f) =>
        f.path.toLowerCase() === "index.html" ||
        f.path.toLowerCase().endsWith("/index.html") ||
        f.path.toLowerCase().endsWith(".html")
    );
  }

  /**
   * Locate primary HTML entry point for the project.
   */
  findEntryFile(files: StoredFile[], preferredPath?: string | null): StoredFile | null {
    if (preferredPath && preferredPath.endsWith(".html")) {
      const match = files.find((f) => normalizePath(f.path) === normalizePath(preferredPath));
      if (match) return match;
    }

    const indexMatch = files.find(
      (f) => normalizePath(f.path) === "index.html" || normalizePath(f.path).endsWith("/index.html")
    );
    if (indexMatch) return indexMatch;

    return files.find((f) => f.path.endsWith(".html")) || null;
  }

  /**
   * Validate HTML, CSS, JavaScript, and asset references.
   * Truthful BUILD/VALIDATE pipeline without pretending to run native compilers.
   */
  async buildAndValidate(files: StoredFile[], preferredEntry?: string | null): Promise<WebBuildResult> {
    const problems: Problem[] = [];
    const linkedStyles: string[] = [];
    const linkedScripts: string[] = [];
    const assets: string[] = [];

    const entryFile = this.findEntryFile(files, preferredEntry);

    if (!entryFile) {
      problems.push({
        severity: "error",
        file: "index.html",
        line: 1,
        column: 1,
        message: "No index.html entry point found in the project.",
        source: "Web Validator",
      });

      return {
        success: false,
        entryFile: "",
        linkedStyles: [],
        linkedScripts: [],
        assets: [],
        problems,
        html: "",
        timestamp: Date.now(),
      };
    }

    // 1. Validate HTML structure & references using DOMParser
    if (typeof window !== "undefined" && window.DOMParser) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(entryFile.content, "text/html");

      const parserError = doc.querySelector("parsererror");
      if (parserError) {
        problems.push({
          severity: "error",
          file: entryFile.path,
          line: 1,
          column: 1,
          message: `HTML Syntax Error: ${parserError.textContent?.slice(0, 100) || "Malformed HTML"}`,
          source: "HTML Validator",
        });
      }

      // Validate Stylesheets
      const linkTags = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
      for (const link of linkTags) {
        const href = link.getAttribute("href");
        if (href && !href.startsWith("http://") && !href.startsWith("https://") && !href.startsWith("//")) {
          const normHref = normalizePath(href);
          linkedStyles.push(normHref);
          const found = files.some((f) => normalizePath(f.path) === normHref);
          if (!found) {
            const loc = findLineAndColumn(entryFile.content, href);
            problems.push({
              severity: "error",
              file: entryFile.path,
              line: loc.line,
              column: loc.column,
              message: `Missing stylesheet: "${href}" could not be resolved in the project.`,
              source: "Link Validator",
            });
          }
        }
      }

      // Validate Scripts
      const scriptTags = Array.from(doc.querySelectorAll("script[src]"));
      for (const script of scriptTags) {
        const src = script.getAttribute("src");
        if (src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("//")) {
          const normSrc = normalizePath(src);
          linkedScripts.push(normSrc);
          const found = files.some((f) => normalizePath(f.path) === normSrc);
          if (!found) {
            const loc = findLineAndColumn(entryFile.content, src);
            problems.push({
              severity: "error",
              file: entryFile.path,
              line: loc.line,
              column: loc.column,
              message: `Missing script: "${src}" could not be resolved in the project.`,
              source: "Script Validator",
            });
          }
        }
      }

      // Validate Media & Images
      const mediaTags = Array.from(doc.querySelectorAll("img[src], source[src]"));
      for (const media of mediaTags) {
        const src = media.getAttribute("src");
        if (src && !src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("data:")) {
          const normSrc = normalizePath(src);
          assets.push(normSrc);
          const found = files.some((f) => normalizePath(f.path) === normSrc);
          if (!found) {
            const loc = findLineAndColumn(entryFile.content, src);
            problems.push({
              severity: "warning",
              file: entryFile.path,
              line: loc.line,
              column: loc.column,
              message: `Missing asset: "${src}" not found in project directory.`,
              source: "Asset Validator",
            });
          }
        }
      }
    }

    // 2. Validate CSS syntax
    const cssFiles = files.filter((f) => f.path.endsWith(".css"));
    for (const cssFile of cssFiles) {
      const issues = this.validateCSS(cssFile.content, cssFile.path);
      problems.push(...issues);
    }

    // 3. Validate JavaScript syntax
    const jsFiles = files.filter((f) => f.path.endsWith(".js"));
    for (const jsFile of jsFiles) {
      const issues = this.validateJavaScript(jsFile.content, jsFile.path);
      problems.push(...issues);
    }

    // 4. Generate Snapshot
    const snapshot = this.generatePreviewDocument(files, entryFile.path);

    const hasErrors = problems.some((p) => p.severity === "error");

    return {
      success: !hasErrors,
      entryFile: entryFile.path,
      linkedStyles,
      linkedScripts,
      assets,
      problems,
      html: snapshot.html,
      timestamp: Date.now(),
    };
  }

  /**
   * Lightweight CSS syntax checker (brace balancing and declaration checks).
   */
  private validateCSS(content: string, filePath: string): Problem[] {
    const problems: Problem[] = [];
    let openBraces = 0;
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      // strip comments
      const clean = lineText.replace(/\/\*.*?\*\//g, "");
      const opens = (clean.match(/\{/g) || []).length;
      const closes = (clean.match(/\}/g) || []).length;
      openBraces += opens - closes;

      if (openBraces < 0) {
        problems.push({
          severity: "error",
          file: filePath,
          line: i + 1,
          column: lineText.indexOf("}") + 1,
          message: "Unexpected closing brace '}' without opening rule.",
          source: "CSS Validator",
        });
        openBraces = 0;
      }
    }

    if (openBraces > 0) {
      problems.push({
        severity: "error",
        file: filePath,
        line: lines.length,
        column: 1,
        message: `Unclosed CSS block (${openBraces} missing '}')`,
        source: "CSS Validator",
      });
    }

    return problems;
  }

  /**
   * Safe JavaScript syntax validation via function constructor check.
   */
  private validateJavaScript(content: string, filePath: string): Problem[] {
    const problems: Problem[] = [];

    // Strip static import/export statements for standard Function parser compatibility
    const stripped = content
      .replace(/^\s*import\s+.*?from\s+['"].*?['"];?/gm, "// [import statement]")
      .replace(/^\s*import\s+['"].*?['"];?/gm, "// [import statement]")
      .replace(/^\s*export\s+default\s+/gm, "const _default = ")
      .replace(/^\s*export\s+(?:const|let|var|function|class)\s+/gm, "");

    try {
      // Test parse syntax without executing
      new Function(stripped);
    } catch (err: any) {
      const msg = err.message || String(err);
      let line = 1;
      let col = 1;

      // Extract line number if provided by engine (e.g. line X)
      const lineMatch = msg.match(/(?:line|at line)\s*(\d+)/i);
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10) || 1;
      }

      problems.push({
        severity: "error",
        file: filePath,
        line,
        column: col,
        message: `SyntaxError: ${msg}`,
        source: "JavaScript Syntax Validator",
      });
    }

    return problems;
  }

  /**
   * Generate an isolated, bundled HTML preview document with local virtual asset mapping
   * and runtime console / error capturing.
   */
  generatePreviewDocument(files: StoredFile[], entryPath?: string | null): PreviewSnapshot {
    this.cleanupOldBlobUrls();

    const entryFile = this.findEntryFile(files, entryPath);
    const createdUrls: string[] = [];

    if (!entryFile) {
      return {
        html: `<!DOCTYPE html><html><body style="background:#0d0f12;color:#9ca3af;font-family:sans-serif;padding:30px;text-align:center;"><h3>No index.html found</h3><p>Create an index.html file to preview your website.</p></body></html>`,
        blobUrls: [],
        cleanup: () => {},
      };
    }

    const fileMap = new Map<string, StoredFile>();
    files.forEach((f) => {
      fileMap.set(normalizePath(f.path), f);
    });

    if (typeof window === "undefined" || !window.DOMParser) {
      return { html: entryFile.content, blobUrls: [], cleanup: () => {} };
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(entryFile.content, "text/html");

    // 1. Invert/Resolve relative SVG & image assets to Data URIs or Blob URLs
    const mediaElements = Array.from(doc.querySelectorAll("img[src], source[src]"));
    mediaElements.forEach((el) => {
      const src = el.getAttribute("src");
      if (src && !src.startsWith("http") && !src.startsWith("data:")) {
        const norm = normalizePath(src);
        const match = fileMap.get(norm);
        if (match) {
          if (norm.endsWith(".svg")) {
            el.setAttribute("src", `data:image/svg+xml;utf8,${encodeURIComponent(match.content)}`);
          } else {
            const blob = new Blob([match.content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            this.activeBlobUrls.add(url);
            el.setAttribute("src", url);
          }
        }
      }
    });

    // 2. Resolve Linked Stylesheets into inline <style> blocks (zero cross-origin latency)
    const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"]'));
    links.forEach((link) => {
      const href = link.getAttribute("href");
      if (href && !href.startsWith("http") && !href.startsWith("//")) {
        const norm = normalizePath(href);
        const match = fileMap.get(norm);
        if (match) {
          let css = match.content;

          // Resolve internal CSS url(...) to data URIs
          css = css.replace(/url\(['"]?(.*?)['"]?\)/g, (full, assetPath) => {
            if (assetPath.startsWith("data:") || assetPath.startsWith("http")) return full;
            const normAsset = normalizePath(assetPath);
            const assetFile = fileMap.get(normAsset);
            if (assetFile) {
              if (normAsset.endsWith(".svg")) {
                return `url("data:image/svg+xml;utf8,${encodeURIComponent(assetFile.content)}")`;
              }
            }
            return full;
          });

          const styleTag = doc.createElement("style");
          styleTag.setAttribute("data-virtual-source", norm);
          styleTag.textContent = css;
          link.replaceWith(styleTag);
        }
      }
    });

    // 3. Build ImportMap for ES Modules
    const importMapEntries: Record<string, string> = {};
    files
      .filter((f) => f.path.endsWith(".js") || f.path.endsWith(".mjs"))
      .forEach((f) => {
        const norm = normalizePath(f.path);
        const blob = new Blob([f.content], { type: "application/javascript" });
        const url = URL.createObjectURL(blob);
        createdUrls.push(url);
        this.activeBlobUrls.add(url);
        importMapEntries[`./${norm}`] = url;
        importMapEntries[norm] = url;
      });

    if (Object.keys(importMapEntries).length > 0) {
      const importMapScript = doc.createElement("script");
      importMapScript.type = "importmap";
      importMapScript.textContent = JSON.stringify({ imports: importMapEntries });
      if (doc.head) {
        doc.head.prepend(importMapScript);
      }
    }

    // 4. Resolve Scripts
    const scripts = Array.from(doc.querySelectorAll("script[src]"));
    scripts.forEach((script) => {
      const src = script.getAttribute("src");
      if (src && !src.startsWith("http") && !src.startsWith("//")) {
        const norm = normalizePath(src);
        const match = fileMap.get(norm);
        if (match) {
          const inlineScript = doc.createElement("script");
          const type = script.getAttribute("type");
          if (type) inlineScript.setAttribute("type", type);
          inlineScript.setAttribute("data-virtual-source", norm);
          inlineScript.textContent = match.content;
          script.replaceWith(inlineScript);
        }
      }
    });

    // 5. Inject Console Interceptor & Runtime Error Telemetry Harness
    const harnessScript = doc.createElement("script");
    harnessScript.textContent = `
(function() {
  function post(type, payload) {
    try {
      window.parent.postMessage({
        type: "solix-preview-" + type,
        ...payload,
        timestamp: Date.now()
      }, "*");
    } catch(e) {}
  }

  function serializeArg(arg) {
    if (typeof arg === "string") return arg;
    if (typeof arg === "number" || typeof arg === "boolean" || arg === null || arg === undefined) return String(arg);
    try {
      return JSON.stringify(arg);
    } catch(e) {
      return String(arg);
    }
  }

  // Intercept Console APIs
  const origLog = console.log;
  const origInfo = console.info;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = function(...args) {
    origLog.apply(console, args);
    post("console", { level: "log", text: args.map(serializeArg).join(" ") });
  };
  console.info = function(...args) {
    origInfo.apply(console, args);
    post("console", { level: "info", text: args.map(serializeArg).join(" ") });
  };
  console.warn = function(...args) {
    origWarn.apply(console, args);
    post("console", { level: "warn", text: args.map(serializeArg).join(" ") });
  };
  console.error = function(...args) {
    origError.apply(console, args);
    post("console", { level: "error", text: args.map(serializeArg).join(" ") });
  };

  // Intercept Runtime Uncaught Errors
  window.addEventListener("error", function(e) {
    let file = "script.js";
    if (e.filename) {
      const parts = e.filename.split("/");
      file = parts[parts.length - 1] || "script.js";
    }
    post("error", {
      message: e.message || "Uncaught runtime exception",
      file: file,
      line: e.lineno || 1,
      column: e.colno || 1
    });
  });

  // Intercept Unhandled Promise Rejections
  window.addEventListener("unhandledrejection", function(e) {
    const reason = e.reason;
    post("error", {
      message: reason && reason.message ? reason.message : ("Unhandled Promise Rejection: " + String(reason)),
      file: "script.js",
      line: 1,
      column: 1
    });
  });

  post("ready", { status: "ready" });
})();
`;

    // 6. Inject Security Isolation Meta Tags
    const cspMeta = doc.createElement("meta");
    cspMeta.httpEquiv = "Content-Security-Policy";
    cspMeta.content = "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; connect-src https: data: blob:; object-src 'none';";

    if (doc.head) {
      doc.head.prepend(harnessScript);
      doc.head.prepend(cspMeta);
    }

    const finalHtml = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;

    return {
      html: finalHtml,
      blobUrls: createdUrls,
      cleanup: () => {
        createdUrls.forEach((u) => {
          try {
            URL.revokeObjectURL(u);
            this.activeBlobUrls.delete(u);
          } catch (_) {}
        });
      },
    };
  }

  /**
   * Cleanup any previously generated blob URLs to prevent browser memory leaks.
   */
  cleanupOldBlobUrls(): void {
    this.activeBlobUrls.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch (_) {}
    });
    this.activeBlobUrls.clear();
  }
}

export const webPreviewBuilder = new WebPreviewBuilder();

