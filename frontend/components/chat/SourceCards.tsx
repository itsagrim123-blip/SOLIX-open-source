"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { SearchSource } from "@/types/chat";

interface SourceCardsProps {
  sources: SearchSource[];
}

export const SourceCards: React.FC<SourceCardsProps> = ({ sources }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <div className="solix-sources">
      <div className="solix-sources-label">
        <span className="solix-sources-icon">⊕</span>
        Sources
      </div>
      <div className="solix-sources-list">
        {sources.map((src) => (
          <a
            key={src.id}
            href={src.url}
            target="_blank"
            rel="noopener noreferrer"
            className="solix-source-card"
            title={src.title}
            aria-label={`Source ${src.id}: ${src.title} — ${src.domain}`}
          >
            <span className="solix-source-num">[{src.id}]</span>
            <span className="solix-source-body">
              <span className="solix-source-title">{src.title}</span>
              <span className="solix-source-domain">{src.domain}</span>
            </span>
            <ExternalLink className="solix-source-ext w-2.5 h-2.5 flex-shrink-0" />
          </a>
        ))}
      </div>
    </div>
  );
};

