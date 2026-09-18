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

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  // Dedicated Workspace Mode Transition State Machine: "idle" | "entering" | "active" | "exiting"
  const [workspaceTransition, setWorkspaceTransition] = useState<
    "idle" | "entering" | "active" | "exiting"
  >("idle");
  const transitionTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Derived active view for subcomponent indicators
  const activeView: "chat" | "coding" =
    workspaceTransition === "active" || workspaceTransition === "entering"
      ? "coding"
      : "chat";

  const [composerPrefill, setComposerPrefill] = useState("");
  const [temperature, setTemperature] = useState<number>(0.7);
  const [systemPrompt, setSystemPrompt] = useState<string>("");

  // Load saved temperature & system prompt preferences from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const savedTemp = localStorage.getItem("solix_temperature");
        if (savedTemp) setTemperature(parseFloat(savedTemp));
        const savedPrompt = localStorage.getItem("solix_system_prompt");
        if (savedPrompt) setSystemPrompt(savedPrompt);
      } catch {
        // ignore storage errors
      }
    }
  }, []);

  // Cleanup pending transition timers on unmount
  useEffect(() => {
    return () => {
      transitionTimersRef.current.forEach(clearTimeout);
    };
  }, []);

  // Mode Switch Handler with Cinematic Solix Dragon Transition & SFX (650-800ms)
  const handleSwitchView = useCallback(
    (target: "chat" | "coding") => {
      // Prevent re-triggering while a transition is actively in flight
      if (workspaceTransition === "entering" || workspaceTransition === "exiting") {
        return;
      }
      if (target === "coding" && workspaceTransition === "active") return;
      if (target === "chat" && workspaceTransition === "idle") return;

      // Check prefers-reduced-motion for accessibility (instant 0ms switch)
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        setWorkspaceTransition(target === "coding" ? "active" : "idle");
        if (target === "coding") {
          setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
        }
        return;
      }

      // Clear any prior active timeouts
      transitionTimersRef.current.forEach(clearTimeout);
      transitionTimersRef.current = [];

      if (target === "coding") {
        // 1. Play failure-safe Workspace SFX at the exact start (0ms)
        playWorkspaceTransitionSFX();

        // 2. Start entering transition (0-220ms: Chat collapses, 150-450ms: logo reveals, 350-700ms: workspace reveals)
        setWorkspaceTransition("entering");

        // 3. Trigger Monaco resize during expansion (350ms)
        const t1 = setTimeout(() => {
          window.dispatchEvent(new Event("resize"));
        }, 350);

        // 4. Conclude transition into active fullscreen workspace (720ms)
        const t2 = setTimeout(() => {
          setWorkspaceTransition("active");
          window.dispatchEvent(new Event("resize"));
        }, 720);

        transitionTimersRef.current = [t1, t2];
      } else {
        // Reverse transition: Workspace -> Chat (0-220ms: workspace collapses, 120-450ms: logo, 180-600ms: chat returns)
        setWorkspaceTransition("exiting");

        // Conclude reverse transition into idle chat (700ms)
        const t1 = setTimeout(() => {
          setWorkspaceTransition("idle");
        }, 700);

        transitionTimersRef.current = [t1];
      }
    },
    [workspaceTransition]
  );

  const handleSendMessage = (content: string) => {
    sendMessage(content, { systemPrompt, temperature });
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
          workspaceTransition === "idle"
            ? "opacity-100 scale-100 pointer-events-auto relative z-10"
            : workspaceTransition === "active"
            ? "opacity-0 pointer-events-none absolute inset-0 invisible z-0"
            : "pointer-events-none relative z-10"
        }`}
        aria-hidden={workspaceTransition === "active"}
      >
        {/* Left Full-Height Sidebar (255px) */}
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
          transitionState={workspaceTransition}
        />

        {/* Main Content Column on Right */}
        <main
          className={`solix-main ${
            workspaceTransition === "entering"
              ? "solix-main-entering"
              : workspaceTransition === "exiting"
              ? "solix-main-returning"
              : ""
          }`}
        >
          {/* Topbar (58px) */}
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
            />
          </section>
        </main>
      </div>

      {/* ========================================================================= */}
      {/* 2. Full-Screen Workspace Container (100vw x 100dvh, NO sidebar or gap)    */}
      {/* ========================================================================= */}
      <div
        className={`fixed inset-0 w-screen h-[100dvh] bg-[#0d0e10] ${
          workspaceTransition === "active"
            ? "opacity-100 scale-100 pointer-events-auto visible z-30"
            : workspaceTransition === "entering"
            ? "visible z-30 pointer-events-none solix-workspace-entering"
            : workspaceTransition === "exiting"
            ? "visible z-30 pointer-events-none solix-workspace-exiting"
            : "opacity-0 scale-98 pointer-events-none invisible absolute inset-0 z-0"
        }`}
        aria-hidden={workspaceTransition !== "active" && workspaceTransition !== "entering"}
      >
        <WorkspaceView
          onBackToChat={() => handleSwitchView("chat")}
          workspace={workspace}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. Pure Centered Solix Dragon Logo Transition (No loading screen/spinners) */}
      {/* ========================================================================= */}
      <WorkspaceTransitionOverlay state={workspaceTransition} />

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
