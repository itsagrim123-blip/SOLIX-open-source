"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { ChatHeader } from "@/components/layout/ChatHeader";
import { ChatSidebar } from "@/components/layout/ChatSidebar";
import { AboutModal } from "@/components/modals/AboutModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import { WorkspaceTransitionOverlay } from "@/components/workspace/WorkspaceTransitionOverlay";
import { playWorkspaceTransitionSFX } from "@/lib/sound";
import { useChat } from "@/hooks/useChat";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useWorkspaceAvailability } from "@/hooks/useWorkspaceAvailability";
import { Monitor } from "lucide-react";

export default function SolixApp() {
  const {
    conversations,
    activeConversationId,
    messages,
    models,
    currentModel,
    isSwitchingModel,
    switchingModelTarget,
    modelSwitchSuccess,
    selectModel,
    isGenerating,
    isLoadingHistory,
    backendStatus,
    isBackendConnected,
    isProviderConnected,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    clearAllLocalChats,
    stopGenerating,
    sendMessage,
    regenerateResponse,
    webSearchEnabled,
    toggleWebSearch,
    webSearchStatus,
    attachedFiles,
    uploadFiles,
    removeFile,
    retryFile,
    fileStatusLabel,
  } = useChat();

  // Lifted Workspace State: Persists open files, terminal, patches, and AI chat across view switches
  const workspace = useWorkspace();

  // Desktop Capability / Hardware Pointer Detection
  const { isSupported: isWorkspaceSupported, status: workspaceStatus } = useWorkspaceAvailability();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Persistent Transition Architecture:
  // viewMode = "chat" | "workspace"
  // transitionState = "idle" | "entering-workspace" | "workspace-active" | "exiting-workspace" | "chat-active"
  const [viewMode, setViewMode] = useState<"chat" | "workspace">("chat");
  const [transitionState, setTransitionState] = useState<
    "idle" | "entering-workspace" | "workspace-active" | "exiting-workspace" | "chat-active"
  >("idle");
  const transitionTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Support direct deep link ?view=workspace on supported desktop devices
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get("view") === "workspace" && isWorkspaceSupported) {
          setViewMode("workspace");
          setTransitionState("workspace-active");
        }
      } catch {
        // ignore
      }
    }
  }, [isWorkspaceSupported]);

  // Derived active view for subcomponent indicators
  const activeView: "chat" | "coding" =
    viewMode === "workspace" || transitionState === "entering-workspace"
      ? "coding"
      : "chat";

  const [composerPrefill, setComposerPrefill] = useState("");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [responseStyle, setResponseStyle] = useState<"default" | "concise" | "detailed">("default");
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  // Load saved preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTemp = localStorage.getItem("solix_temperature");
        if (savedTemp) setTemperature(parseFloat(savedTemp));
        const savedStyle = localStorage.getItem("solix_response_style") as "default" | "concise" | "detailed" | null;
        if (savedStyle) setResponseStyle(savedStyle);
        const savedPrompt = localStorage.getItem("solix_system_prompt");
        if (savedPrompt) setSystemPrompt(savedPrompt);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  const handleUpdateTemperature = (val: number) => {
    setTemperature(val);
    try {
      localStorage.setItem("solix_temperature", String(val));
    } catch {
      // ignore
    }
  };

  const handleUpdateResponseStyle = (style: "default" | "concise" | "detailed") => {
    setResponseStyle(style);
    try {
      localStorage.setItem("solix_response_style", style);
    } catch {
      // ignore
    }
  };

  // Global Keyboard Shortcuts (Ctrl+N for new chat, Escape to close modals)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        startNewChat();
      }
      if (e.key === "Escape") {
        setIsSettingsOpen(false);
        setIsAboutOpen(false);
        setIsMobileSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [startNewChat]);

  // Cleanup pending transition timers on unmount
  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Mode Switch Handler with Cinematic Solix Dragon Transition & SFX (800ms)
  const handleSwitchView = useCallback(
    (target: "chat" | "coding") => {
      // Prevent overlapping triggers during active transition
      if (
        transitionState === "entering-workspace" ||
        transitionState === "exiting-workspace"
      ) {
        return;
      }
      // Prevent opening workspace on unsupported/mobile devices
      if (target === "coding" && !isWorkspaceSupported) {
        return;
      }
      if (
        target === "coding" &&
        (viewMode === "workspace" || transitionState === "workspace-active")
      ) {
        return;
      }
      if (
        target === "chat" &&
        (viewMode === "chat" ||
          transitionState === "chat-active" ||
          transitionState === "idle")
      ) {
        return;
      }
      // Clear any prior active transition timers
      transitionTimersRef.current.forEach(clearTimeout);
      transitionTimersRef.current = [];

      if (target === "coding") {
        console.log("[Solix] WORKSPACE TRANSITION START");

        // 1. Play SFX at exact t=0ms
        playWorkspaceTransitionSFX();

        // 2. Set transition state to entering (chat begins collapse, overlay mounts)
        setTransitionState("entering-workspace");

        // 3. Logo becomes visible (150ms)
        const tLogo = setTimeout(() => {
          console.log("[Solix] WORKSPACE LOGO SHOW");
        }, 150);

        // 4. Reveal Workspace behind overlay (350ms)
        const tReveal = setTimeout(() => {
          console.log("[Solix] WORKSPACE REVEAL");
          setViewMode("workspace");
          window.dispatchEvent(new Event("resize"));
        }, 350);

        // 5. Complete transition (800ms)
        const tComplete = setTimeout(() => {
          console.log("[Solix] WORKSPACE TRANSITION COMPLETE");
          setTransitionState("workspace-active");
          window.dispatchEvent(new Event("resize"));
        }, 800);

        transitionTimersRef.current = [tLogo, tReveal, tComplete];
      } else {
        console.log("[Solix] WORKSPACE -> CHAT TRANSITION START");

        // 1. Set transition state to exiting (workspace begins collapse, overlay mounts)
        setTransitionState("exiting-workspace");

        // 2. Logo becomes visible (150ms)
        const tLogo = setTimeout(() => {
          console.log("[Solix] WORKSPACE LOGO SHOW");
        }, 150);

        // 3. Reveal Chat behind overlay (350ms)
        const tReveal = setTimeout(() => {
          console.log("[Solix] CHAT REVEAL");
          setViewMode("chat");
        }, 350);

        // 4. Complete transition (800ms)
        const tComplete = setTimeout(() => {
          console.log("[Solix] CHAT TRANSITION COMPLETE");
          setTransitionState("chat-active");
        }, 800);

        transitionTimersRef.current = [tLogo, tReveal, tComplete];
      }
    },
    [viewMode, transitionState, isWorkspaceSupported]
  );

  const getEffectiveSystemPrompt = useCallback(() => {
    let promptModifier = systemPrompt;
    if (responseStyle === "concise") {
      promptModifier = (promptModifier ? promptModifier + "\n" : "") + "Please provide concise, direct answers without unnecessary filler.";
    } else if (responseStyle === "detailed") {
      promptModifier = (promptModifier ? promptModifier + "\n" : "") + "Please provide comprehensive, in-depth explanations with detailed examples and context.";
    }
    return promptModifier;
  }, [systemPrompt, responseStyle]);

  const handleSendMessage = (content: string) => {
    const effPrompt = getEffectiveSystemPrompt();
    sendMessage(content, { systemPrompt: effPrompt, temperature });
    setComposerPrefill("");
  };

  const handleEditPrompt = (content: string) => {
    setComposerPrefill(content);
  };

  const handleRegenerate = (messageId: string) => {
    const effPrompt = getEffectiveSystemPrompt();
    regenerateResponse(messageId, { systemPrompt: effPrompt, temperature });
  };

  const handleSelectSuggestion = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="solix-app select-none relative overflow-hidden w-screen h-[100dvh]">
      {/* ========================================================================= */}
      {/* 1. Normal Chat Mode Container (Sidebar + ChatHeader + Message Stream)    */}
      {/* ========================================================================= */}
      <div
        className={`w-full h-full flex ${
          viewMode === "chat" && (transitionState === "idle" || transitionState === "chat-active")
            ? "opacity-100 scale-100 pointer-events-auto relative z-10"
            : transitionState === "entering-workspace"
            ? "pointer-events-none relative z-10"
            : transitionState === "exiting-workspace" && viewMode === "chat"
            ? "pointer-events-none relative z-10"
            : "opacity-0 pointer-events-none absolute inset-0 invisible z-0"
        }`}
        aria-hidden={viewMode !== "chat"}
      >
        {/* Left Full-Height Sidebar */}
        <ChatSidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onSelectConversation={selectConversation}
          onNewChat={startNewChat}
          onDeleteConversation={deleteConversation}
          onRenameConversation={renameConversation}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenAbout={() => setIsAboutOpen(true)}
          isMobileOpen={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          activeView={activeView}
          onSelectView={handleSwitchView}
          transitionState={
            transitionState === "entering-workspace"
              ? "entering"
              : transitionState === "exiting-workspace" && viewMode === "chat"
              ? "exiting"
              : "idle"
          }
          isWorkspaceSupported={isWorkspaceSupported}
        />

        {/* Main Content Column on Right */}
        <main
          className={`solix-main ${
            transitionState === "entering-workspace"
              ? "animate-chat-main-collapse"
              : transitionState === "exiting-workspace" && viewMode === "chat"
              ? "animate-chat-main-reveal"
              : ""
          }`}
        >
          {/* Topbar (38px/48px) */}
          <ChatHeader
            currentModel={currentModel}
            models={models}
            onSelectModel={selectModel}
            isBackendConnected={isBackendConnected}
            backendStatus={backendStatus}
            isSwitchingModel={isSwitchingModel}
            switchingModelTarget={switchingModelTarget}
            modelSwitchSuccess={modelSwitchSuccess}
            onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
            onNewChat={startNewChat}
            onOpenSettings={() => setIsSettingsOpen(true)}
            activeView={activeView}
            onSelectView={handleSwitchView}
          />

          {/* Chat Workspace */}
          <section className="solix-workspace">
            {/* Messages or Welcome Screen */}
            <MessageList
              messages={messages}
              isGenerating={isGenerating}
              isLoadingHistory={isLoadingHistory}
              modelName={currentModel}
              onSelectPrompt={handleSelectSuggestion}
              onEditPrompt={handleEditPrompt}
              onRegenerate={handleRegenerate}
            />

            {/* Floating Composer at Bottom */}
            <MessageComposer
              onSendMessage={handleSendMessage}
              onStopGenerating={stopGenerating}
              isGenerating={isGenerating}
              models={models}
              currentModel={currentModel}
              onSelectModel={selectModel}
              isSwitchingModel={isSwitchingModel}
              switchingModelTarget={switchingModelTarget}
              modelSwitchSuccess={modelSwitchSuccess}
              initialValue={composerPrefill}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={toggleWebSearch}
              webSearchStatus={webSearchStatus}
              attachedFiles={attachedFiles}
              onUploadFiles={uploadFiles}
              onRemoveFile={removeFile}
              onRetryFile={retryFile}
              fileStatusLabel={fileStatusLabel}
              temperature={temperature}
              onUpdateTemperature={handleUpdateTemperature}
              responseStyle={responseStyle}
              onUpdateResponseStyle={handleUpdateResponseStyle}
            />
          </section>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. Full-Screen Workspace Container (100vw x 100dvh, NO sidebar or gap)    */}
      {/* ========================================================================= */}
      <div
        className={`fixed inset-0 w-screen h-[100dvh] bg-[#0d0e10] ${
          viewMode === "workspace" && transitionState === "workspace-active"
            ? "opacity-100 scale-100 pointer-events-auto visible z-30"
            : transitionState === "entering-workspace" && viewMode === "workspace"
            ? "visible z-30 pointer-events-none animate-workspace-reveal"
            : transitionState === "exiting-workspace"
            ? "visible z-30 pointer-events-none animate-workspace-collapse"
            : "opacity-0 scale-98 pointer-events-none invisible absolute inset-0 z-0"
        }`}
        aria-hidden={viewMode !== "workspace"}
      >
        <WorkspaceView
          onBackToChat={() => handleSwitchView("chat")}
          workspace={workspace}
        />

        {/* Desktop Screen Resize Guard (Preserves all workspace memory and state underneath) */}
        {viewMode === "workspace" && !isWorkspaceSupported && workspaceStatus === "unsupported" && (
          <div className="absolute inset-0 z-50 bg-[#0d0e10]/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in duration-200">
            <div className="w-12 h-12 rounded-xs bg-[#141518] border border-[#26282f] flex items-center justify-center mb-4 text-[#858b94] shadow-xs">
              <Monitor className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="text-base font-semibold text-white font-sans tracking-tight mb-1.5">
              Workspace requires a larger screen
            </h2>
            <p className="text-xs text-[#858b94] font-sans max-w-sm leading-relaxed mb-5">
              Solix Workspace is optimized for desktop displays with a physical keyboard. Please expand your browser window or return to Chat.
            </p>
            <button
              onClick={() => handleSwitchView("chat")}
              className="px-4 py-2 rounded-xs bg-[#181a1f] border border-[#2b2e36] hover:border-[#3d424e] hover:bg-[#202229] text-xs font-semibold text-white transition-all cursor-pointer shadow-xs active:scale-98"
            >
              Return to Chat
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. Pure Centered Solix Dragon Logo Transition (Portal to document.body)   */}
      {/* ========================================================================= */}
      <WorkspaceTransitionOverlay transitionState={transitionState} />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        models={models}
        currentModel={currentModel}
        onSelectModel={selectModel}
        isBackendConnected={isBackendConnected}
        isProviderConnected={isProviderConnected}
        temperature={temperature}
        onUpdateTemperature={setTemperature}
        systemPrompt={systemPrompt}
        onUpdateSystemPrompt={setSystemPrompt}
        onClearChats={clearAllLocalChats}
      />

      {/* About Solix Modal */}
      <AboutModal
        isOpen={isAboutOpen}
        onClose={() => setIsAboutOpen(false)}
        currentModel={currentModel}
      />
    </div>
  );
}
