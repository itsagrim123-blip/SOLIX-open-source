"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  Cpu,
  Database,
  Globe,
  Sliders,
  Terminal,
  X,
  XCircle,
} from "lucide-react";
import { ModelInfo } from "@/types/chat";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  models: ModelInfo[];
  currentModel: string;
  onSelectModel: (modelId: string) => void;
  isBackendConnected: boolean;
  isProviderConnected: boolean;
  temperature: number;
  onUpdateTemperature: (temp: number) => void;
  systemPrompt: string;
  onUpdateSystemPrompt: (prompt: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  models,
  currentModel,
  onSelectModel,
  isBackendConnected,
  isProviderConnected,
  temperature,
  onUpdateTemperature,
  systemPrompt,
  onUpdateSystemPrompt,
}) => {
  const [localTemp, setLocalTemp] = useState(temperature);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);

  useEffect(() => {
    setLocalTemp(temperature);
    setLocalPrompt(systemPrompt);
  }, [temperature, systemPrompt]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    onUpdateTemperature(localTemp);
    onUpdateSystemPrompt(localPrompt);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg glass-panel rounded-2xl p-6 border border-white/10 shadow-glass-lg relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-400/30 text-cyan-300 shadow-glow-cyan">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                Solix Settings
              </h2>
              <p className="text-xs text-slate-400">
                Configure AI model, system parameters, and connection status
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] border border-transparent hover:border-white/[0.08] transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-5 text-xs sm:text-sm max-h-[70vh] overflow-y-auto pr-1">
          {/* Status Section */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              System Health & Engine
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Backend API */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Globe className="w-4 h-4 text-cyan-400" />
                  <span>FastAPI Backend</span>
                </div>
                {isBackendConnected ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-rose-400" />
                )}
              </div>

              {/* Database */}
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2 text-slate-300 font-medium">
                  <Database className="w-4 h-4 text-blue-400" />
                  <span>SQLite Async</span>
                </div>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            </div>

            {/* Ollama Engine Status Banner */}
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-3 ${
                isProviderConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-200"
              }`}
            >
              <Terminal className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-semibold text-xs">
                  {isProviderConnected
                    ? "Local Ollama Connected & Active"
                    : "Ollama Offline — Interactive Simulation Mode Active"}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isProviderConnected
                    ? "Conversational inferences are streaming token-by-token from your local model."
                    : "To connect your local LLM, run `ollama serve` and `ollama pull llama3.2` on your machine."}
                </p>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              Active AI Model
            </label>
            <div className="relative">
              <select
                value={currentModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="w-full bg-[#080d19] border border-white/10 rounded-xl px-3 py-2.5 text-slate-100 text-xs sm:text-sm outline-none focus:border-cyan-400/50 transition-colors shadow-inner"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.details ? `(${m.details})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Temperature (Creativity)
              </label>
              <span className="font-mono text-xs text-cyan-400 font-semibold">
                {localTemp.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={localTemp}
              onChange={(e) => setLocalTemp(parseFloat(e.target.value))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>0.0 (Precise)</span>
              <span>0.7 (Balanced)</span>
              <span>1.5 (Creative)</span>
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
              System Prompt
            </label>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="You are Solix, an elite AI assistant specializing in clear, accurate, and structured insights..."
              rows={3}
              className="w-full bg-[#080d19] border border-white/10 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-cyan-400/50 resize-none transition-colors shadow-inner font-mono"
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="glass-reflection px-4 py-2 rounded-xl text-xs font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-glow-cyan transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
