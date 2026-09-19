"use client";

import React, { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CodeBlockProps {
  language?: string;
  value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code: ", err);
    }
  };

  const displayLang = language || "code";

  return (
    <div className="relative my-3 rounded-lg overflow-hidden border border-[#292b30] bg-[#0e0f12]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-3.5 py-2 bg-[#141518] border-b border-[#292b30]">
        <span
          className="uppercase font-semibold text-[#c8cacd] tracking-wider"
          style={{ fontFamily: "var(--font-code)", fontSize: "11px", letterSpacing: "0.06em" }}
        >
          {displayLang}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[#8f9299] hover:text-[#eeeeec] hover:bg-[#1a1c20] transition-colors border border-transparent hover:border-[#292b30] cursor-pointer"
          style={{ fontSize: "11px" }}
          aria-label="Copy code to clipboard"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code Content */}
      <div
        className="px-4 py-3.5 overflow-x-auto text-[#e0e2e8]"
        style={{ fontFamily: "var(--font-code)", fontSize: "13px", lineHeight: 1.6 }}
      >
        <pre className="!bg-transparent !p-0 !m-0">
          <code>{value}</code>
        </pre>
      </div>
    </div>
  );
};
