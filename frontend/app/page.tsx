"use client";

import React, { useState } from "react";
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
    isGenerating,
    isLoadingHistory,
    backendStatus,
    isBackendConnected,
    isProviderConnected,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    stopGenerating,
    sendMessage,
    setCurrentModel,
  } = useChat();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");

  const handleSelectSuggestion = (prompt: string) => {
    sendMessage(prompt);
  };

  return (
    <div className="app-container select-none">
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

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-full min-h-0 min-w-0 overflow-hidden relative z-10">
        {/* Topbar Header */}
        <ChatHeader
          currentModel={currentModel}
          models={models}
          onSelectModel={setCurrentModel}
          isBackendConnected={isBackendConnected}
          backendStatus={backendStatus}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onNewChat={startNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Message Thread Scroll Area (Strict internal scroll only) */}
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
          onSendMessage={sendMessage}
          onStopGenerating={stopGenerating}
          isGenerating={isGenerating}
          models={models}
          currentModel={currentModel}
          onSelectModel={setCurrentModel}
          initialValue={composerPrefill}
        />
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        models={models}
        currentModel={currentModel}
        onSelectModel={setCurrentModel}
        isBackendConnected={isBackendConnected}
        isProviderConnected={isProviderConnected}
        temperature={temperature}
        onUpdateTemperature={setTemperature}
        systemPrompt={systemPrompt}
        onUpdateSystemPrompt={setSystemPrompt}
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
