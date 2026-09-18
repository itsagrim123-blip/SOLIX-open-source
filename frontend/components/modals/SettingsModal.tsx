"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Globe,
  ShieldCheck,
  Sliders,
  Terminal,
  Trash2,
  X,
  XCircle,
} from "lucide-react";
import { ModelInfo } from "@/types/chat";
import { getModelDescription, getModelLabel } from "@/lib/models";

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
  onClearChats?: () => void;
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
  onClearChats,
}) => {
  const [localTemp, setLocalTemp] = useState(temperature);
  const [localPrompt, setLocalPrompt] = useState(systemPrompt);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);
  const [clearSuccess, setClearSuccess] = useState(false);

  useEffect(() => {
    setLocalTemp(temperature);
    setLocalPrompt(systemPrompt);
  }, [temperature, systemPrompt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsConfirmingClear(false);
        onClose();
      }
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
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("solix_temperature", String(localTemp));
        localStorage.setItem("solix_system_prompt", localPrompt);
      } catch {
        // ignore storage errors
      }
    }
    setIsConfirmingClear(false);
    onClose();
  };

  const handleExecuteClear = () => {
    if (onClearChats) {
      onClearChats();
      setClearSuccess(true);
      setIsConfirmingClear(false);
      setTimeout(() => setClearSuccess(false), 2500);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in select-none"
      onClick={() => {
        setIsConfirmingClear(false);
        onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-[#141518] rounded-xl p-6 border border-[#292b30] shadow-2xl relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#292b30]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#191a1e] border border-[#292b30] flex items-center justify-center text-[#eeeeec]">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#eeeeec]">
                Solix Settings
              </h2>
              <p className="text-[11px] text-[#8f9299]">
                Configure AI model, system parameters, and privacy
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setIsConfirmingClear(false);
              onClose();
            }}
            className="p-1 rounded-lg text-[#8f9299] hover:text-white hover:bg-[#1a1c20] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="py-4 space-y-4 text-xs max-h-[70vh] overflow-y-auto pr-1">
          {/* Status Section */}
          <div className="space-y-1.5">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#666970]">
              System Health & Engine
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#c9cbd0] font-medium text-xs">
                  <Globe className="w-3.5 h-3.5 text-[#dedfe2]" />
                  <span>FastAPI Backend</span>
                </div>
                {isBackendConnected ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                )}
              </div>

              <div className="p-2.5 rounded-lg bg-[#15171a] border border-[#292b30] flex items-center justify-between">
                <div className="flex items-center gap-2 text-[#c9cbd0] font-medium text-xs">
                  <Database className="w-3.5 h-3.5 text-[#dedfe2]" />
                  <span>IndexedDB (Local)</span>
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div
              className={`p-3 rounded-lg border flex items-start gap-2.5 ${
                isProviderConnected
                  ? "bg-emerald-500/[0.06] border-emerald-500/25 text-emerald-300"
                  : "bg-amber-500/[0.06] border-amber-500/25 text-amber-300"
              }`}
            >
              <Terminal className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-xs">
                  {isProviderConnected
                    ? "Local Ollama Connected & Active"
                    : "Ollama Offline — Interactive Simulation Mode"}
                </div>
                <p className="text-[11px] text-[#8f9299] leading-relaxed">
                  {isProviderConnected
                    ? "Conversational inferences are streaming token-by-token from your local hardware."
                    : "To connect local LLMs, start Ollama (`ollama serve`) with models like qwen3:1.7b."}
                </p>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666970]">
              Active AI Model
            </label>
            <div className="relative">
              <select
                value={currentModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="w-full bg-[#15171a] border border-[#292b30] rounded-lg px-3 py-2 text-[#eeeeec] text-xs outline-none focus:border-[#3a3d43] transition-colors"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {getModelLabel(m.id)} — {getModelDescription(m.id)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#666970]">
                Temperature (Creativity)
              </label>
              <span className="font-mono text-xs text-[#dedfe2] font-semibold">
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
              className="w-full accent-[#eeeeec] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-[#666970] font-mono">
              <span>0.0 (Precise)</span>
              <span>0.7 (Balanced)</span>
              <span>1.5 (Creative)</span>
            </div>
          </div>

          {/* System Prompt */}
          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold uppercase tracking-wider text-[#666970]">
              System Prompt
            </label>
            <textarea
              value={localPrompt}
              onChange={(e) => setLocalPrompt(e.target.value)}
              placeholder="You are Solix, an intelligent and helpful AI assistant..."
              rows={3}
              className="w-full bg-[#15171a] border border-[#292b30] rounded-lg p-2.5 text-xs text-[#eeeeec] placeholder-[#666970] outline-none focus:border-[#3a3d43] resize-none transition-colors font-mono"
            />
          </div>

          {/* Privacy & Device Storage Section */}
          <div className="space-y-1.5 pt-2 border-t border-[#292b30]">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#666970]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#dedfe2]" />
              <span>Local Privacy & Storage</span>
            </div>
            <p className="text-[11px] text-[#8f9299] leading-relaxed">
              Your conversations are stored exclusively in this browser's IndexedDB. They are never transmitted across devices or shared with other sessions.
            </p>

            {isConfirmingClear ? (
              <div className="p-3 rounded-lg bg-rose-500/[0.08] border border-rose-500/30 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Delete all local chats?</span>
                </div>
                <p className="text-[11px] text-rose-200/80">
                  This permanently removes all conversations stored in this browser.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleExecuteClear}
                    className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Yes, Delete Everything
                  </button>
                  <button
                    onClick={() => setIsConfirmingClear(false)}
                    className="px-3 py-1.5 rounded-md bg-[#191a1e] hover:bg-[#202328] text-slate-300 text-xs transition-colors cursor-pointer border border-[#292b30]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => setIsConfirmingClear(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/[0.08] hover:bg-rose-500/[0.15] border border-rose-500/20 transition-all cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear Local Chat History</span>
                </button>
                {clearSuccess && (
                  <span className="text-xs text-emerald-400 font-medium animate-fade-in">
                    ✓ All local chats cleared
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-[#292b30] flex items-center justify-end gap-2">
          <button
            onClick={() => {
              setIsConfirmingClear(false);
              onClose();
            }}
            className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-[#8f9299] hover:text-[#eeeeec] hover:bg-[#1a1c20] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-[#0d0e10] bg-[#eeeeec] hover:bg-[#d8d9dc] transition-all cursor-pointer"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>
  );
};
