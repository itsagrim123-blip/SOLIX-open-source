"use client";

import React, { useEffect, useState } from "react";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { ChatHeader } from "@/components/layout/ChatHeader";
import { ChatSidebar } from "@/components/layout/ChatSidebar";
import { AboutModal } from "@/components/modals/AboutModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
import { WorkspaceView } from "@/components/workspace/WorkspaceView";
import { useChat } from "@/hooks/useChat";

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

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [activeView, setActiveView] = useState<"chat" | "coding">("chat");
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

  const handleSendMessage = (content: string) => {
    sendMessage(content, { systemPrompt, temperature });
  };

  const handleSelectSuggestion = (prompt: string) => {
    handleSendMessage(prompt);
  };

  return (
    <div className="solix-app select-none">
      {/* 1. Left Full-Height Sidebar (255px) */}
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
        onSelectView={setActiveView}
      />

      {/* 2. Main Content Column on Right */}
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
          onSelectView={setActiveView}
        />

        {/* View Switch: Coding Workspace vs Normal Chat */}
        {activeView === "coding" ? (
          <WorkspaceView onBackToChat={() => setActiveView("chat")} />
        ) : (
          /* Chat Workspace */
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
        )}
      </main>

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
