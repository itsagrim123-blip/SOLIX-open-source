"use client";

import React, { useEffect, useState } from "react";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { ChatHeader } from "@/components/layout/ChatHeader";
import { ChatSidebar } from "@/components/layout/ChatSidebar";
import { AboutModal } from "@/components/modals/AboutModal";
import { SettingsModal } from "@/components/modals/SettingsModal";
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
    setCurrentModel,
  } = useChat();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
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
    <div className="app-container select-none">
      {/* 1. Full-Width Fixed Header at Top */}
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
      />

      {/* 2. Main Viewport Row (Sidebar + Chat Area) */}
      <div className="flex-1 flex flex-row min-h-0 min-w-0 overflow-hidden relative z-10">
        {/* Sidebar Navigation */}
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
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          isProviderConnected={isProviderConnected}
        />

        {/* Chat Area */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0 overflow-hidden relative">
          {/* Scrollable Messages Area */}
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
            <MessageList
              messages={messages}
              isGenerating={isGenerating}
              isLoadingHistory={isLoadingHistory}
              modelName={currentModel}
              onSelectPrompt={handleSelectSuggestion}
            />
          </div>

          {/* Fixed Glass Composer at Bottom */}
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
          />
        </main>
      </div>

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
