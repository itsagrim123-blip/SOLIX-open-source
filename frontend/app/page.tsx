"use client";

import React, { useState } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { MessageComposer } from "@/components/chat/MessageComposer";
import { MessageList } from "@/components/chat/MessageList";
import { ChatHeader } from "@/components/layout/ChatHeader";
import { ChatSidebar } from "@/components/layout/ChatSidebar";
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
    isBackendConnected,
    isProviderConnected,
    error,
    selectConversation,
    startNewChat,
    deleteConversation,
    renameConversation,
    stopGenerating,
    sendMessage,
    setCurrentModel,
    refreshData,
  } = useChat();

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [composerPrefill, setComposerPrefill] = useState("");
  const [temperature, setTemperature] = useState(0.7);
  const [systemPrompt, setSystemPrompt] = useState("");

  const handleSelectSuggestion = (prompt: string) => {
    // Send message directly
    sendMessage(prompt);
  };

  return (
    <div className="flex h-screen h-[100dvh] w-screen overflow-hidden bg-transparent">
      {/* Sidebar Navigation */}
      <ChatSidebar
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={selectConversation}
        onNewChat={startNewChat}
        onDeleteConversation={deleteConversation}
        onRenameConversation={renameConversation}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        isProviderConnected={isProviderConnected}
      />

      {/* Main Chat Interface */}
      <main className="flex-1 flex flex-col h-screen h-[100dvh] min-h-0 min-w-0 overflow-hidden relative z-10">
        {/* Header */}
        <ChatHeader
          currentModel={currentModel}
          isProviderConnected={isProviderConnected}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
          onNewChat={startNewChat}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Backend Unreachable Alert Banner */}
        {!isBackendConnected && (
          <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2 flex items-center justify-between text-xs text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>
                Unable to reach Solix backend at{" "}
                <code className="bg-black/30 px-1 py-0.5 rounded text-[11px]">
                  {process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}
                </code>
                . Please verify the FastAPI server is running.
              </span>
            </div>
            <button
              onClick={refreshData}
              className="flex items-center gap-1 text-rose-300 hover:text-white px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 transition-colors ml-2"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Chat Thread Messages */}
        <MessageList
          messages={messages}
          isGenerating={isGenerating}
          isLoadingHistory={isLoadingHistory}
          modelName={currentModel}
          onSelectPrompt={handleSelectSuggestion}
        />

        {/* Floating Glass Composer */}
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
    </div>
  );
}

