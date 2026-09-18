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

  // Active View State: 'chat' | 'coding'
  const [activeView, setActiveView] = useState<"chat" | "coding">("chat");

  // Cinematic Transition States
  const [transitionStage, setTransitionStage] = useState<
    "idle" | "fading-out" | "showing-logo" | "fading-in"
  >("idle");
  const [transitionTarget, setTransitionTarget] = useState<"chat" | "coding">("chat");
  const transitionTimeoutRef = useRef<NodeJS.Timeout[]>([]);

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

  // Cleanup pending transition timeouts on unmount
  useEffect(() => {
    return () => {
      transitionTimeoutRef.current.forEach(clearTimeout);
    };
  }, []);

  // Mode Switch Handler with Cinematic Solix Dragon Transition
  const handleSwitchView = useCallback(
    (target: "chat" | "coding") => {
      if (target === activeView && transitionStage === "idle") return;

      // Check prefers-reduced-motion for accessibility
      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (prefersReducedMotion) {
        setActiveView(target);
        if (target === "coding") {
          setTimeout(() => window.dispatchEvent(new Event("resize")), 50);
        }
        return;
      }

      // Clear any prior active timeouts
      transitionTimeoutRef.current.forEach(clearTimeout);
      transitionTimeoutRef.current = [];

      setTransitionTarget(target);
      setTransitionStage("fading-out");

      // 1. Initial fade-out of current interface (130ms) -> Show Solix Logo Overlay
      const t1 = setTimeout(() => {
        setTransitionStage("showing-logo");
      }, 130);

      // 2. Switch the active view behind the backdrop blur (350ms)
      const t2 = setTimeout(() => {
        setActiveView(target);
        // Prompt Monaco Editor to resize to full window
        window.dispatchEvent(new Event("resize"));
      }, 350);

      // 3. Begin fading out overlay to reveal target view (520ms)
      const t3 = setTimeout(() => {
        setTransitionStage("fading-in");
        window.dispatchEvent(new Event("resize"));
      }, 520);

      // 4. Conclude transition and restore complete interactivity (650ms)
      const t4 = setTimeout(() => {
        setTransitionStage("idle");
        window.dispatchEvent(new Event("resize"));
      }, 650);

      transitionTimeoutRef.current.push(t1, t2, t3, t4);
    },
    [activeView, transitionStage]
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
        className={`w-full h-full flex transition-all duration-300 ease-out ${
          activeView === "chat"
            ? "opacity-100 scale-100 pointer-events-auto relative z-10"
            : "opacity-0 scale-98 pointer-events-none absolute inset-0 invisible z-0"
        } ${
          transitionStage === "fading-out" && transitionTarget === "coding"
            ? "blur-[5px] opacity-25 scale-[0.985]"
            : ""
        }`}
        aria-hidden={activeView !== "chat"}
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
        />

        {/* Main Content Column on Right */}
        <main className="solix-main">
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
        className={`fixed inset-0 w-screen h-[100dvh] transition-all duration-300 ease-out bg-[#0d0e10] ${
          activeView === "coding"
            ? "opacity-100 scale-100 pointer-events-auto visible z-30"
            : "opacity-0 scale-98 pointer-events-none invisible z-0"
        } ${
          transitionStage === "fading-out" && transitionTarget === "chat"
            ? "blur-[5px] opacity-25 scale-[0.985]"
            : ""
        }`}
        aria-hidden={activeView !== "coding"}
      >
        <WorkspaceView
          onBackToChat={() => handleSwitchView("chat")}
          workspace={workspace}
        />
      </div>

      {/* ========================================================================= */}
      {/* 3. Cinematic Solix Logo Transition Overlay                                */}
      {/* ========================================================================= */}
      <WorkspaceTransitionOverlay
        stage={transitionStage}
        targetView={transitionTarget}
      />

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
