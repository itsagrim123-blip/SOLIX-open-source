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

  // Persistent Transition Architecture:
  // viewMode = "chat" | "workspace"
  // transitionState = "idle" | "entering-workspace" | "workspace-active" | "exiting-workspace" | "chat-active"
  const [viewMode, setViewMode] = useState<"chat" | "workspace">("chat");
  const [transitionState, setTransitionState] = useState<
    "idle" | "entering-workspace" | "workspace-active" | "exiting-workspace" | "chat-active"
  >("idle");
  const transitionTimersRef = useRef<NodeJS.Timeout[]>([]);

  // Derived active view for subcomponent indicators
  const activeView: "chat" | "coding" =
    viewMode === "workspace" || transitionState === "entering-workspace"
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
    [viewMode, transitionState]
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
          transitionState={
            transitionState === "entering-workspace"
              ? "entering"
              : transitionState === "exiting-workspace" && viewMode === "chat"
              ? "exiting"
              : "idle"
          }
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
