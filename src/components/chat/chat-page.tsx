'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Sun, Moon, PanelLeftClose, PanelLeft } from 'lucide-react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sidebar } from './sidebar';
import { MessageList } from './message-list';
import { InputArea } from './input-area';
import { useConversations } from '@/hooks/use-conversations';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';

export function ChatPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [transcribedText, setTranscribedText] = useState<string | undefined>();
  const [mounted, setMounted] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Track mount state to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close sidebar on mobile by default
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const {
    currentConversation,
    currentConversationId,
    currentMessages,
    createConversation,
    switchConversation,
    clearCurrentConversation,
    deleteConversation,
    renameConversation,
    refreshConversations,
    getGroupedConversations,
  } = useConversations();

  // One-time migration from localStorage to server
  useEffect(() => {
    const stored = localStorage.getItem('notion-assistant-conversations');
    if (stored) {
      fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: stored,
      })
        .then((res) => res.json())
        .then((result) => {
          if (result.success) {
            localStorage.removeItem('notion-assistant-conversations');
            // Refresh to show migrated conversations
            refreshConversations();
          }
        })
        .catch(console.error);
    }
  }, [refreshConversations]);

  // Create transport with conversation ID in body
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
        body: { conversationId: currentConversationId },
      }),
    [currentConversationId]
  );

  // AI SDK useChat hook
  const { messages, sendMessage, setMessages, status, stop } = useChat({
    id: currentConversationId || undefined,
    transport,
    onFinish: () => {
      // Refresh conversations to get updated title
      refreshConversations();
    },
  });

  // Sync messages when conversation changes (currentMessages is loaded from API)
  useEffect(() => {
    setMessages(currentMessages);
  }, [currentMessages, setMessages]);

  const isStreaming = status === 'streaming' || status === 'submitted';

  const handleTranscription = useCallback((text: string) => {
    setTranscribedText(text);
    // Clear after setting so subsequent recordings work
    setTimeout(() => setTranscribedText(undefined), 100);
  }, []);

  const {
    isRecording,
    isTranscribing,
    formattedDuration,
    startRecording,
    stopRecording,
  } = useVoiceRecorder({ onTranscription: handleTranscription });

  const handleNewChat = () => {
    // Clear current conversation - no DB creation yet
    // Conversation will be created lazily when user sends first message
    clearCurrentConversation();
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSend = async (content: string) => {
    if (!content.trim()) return;

    // Create conversation lazily on first message
    let convId = currentConversationId;
    if (!convId) {
      const newConv = await createConversation();
      convId = newConv.id;
    }

    // Send message with explicit conversationId in options.body
    sendMessage(
      { text: content },
      { body: { conversationId: convId } }  // CORRECT: Second parameter
    );
  };

  const handleSendSuggestion = (text: string) => {
    handleSend(text);
  };

  const groups = getGroupedConversations();

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && isMobile && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        groups={groups}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onRenameConversation={renameConversation}
        onDeleteConversation={deleteConversation}
        isOpen={sidebarOpen}
        isMobile={isMobile}
      />

      {/* Main content */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
                >
                  {sidebarOpen ? (
                    <PanelLeftClose className="h-5 w-5" />
                  ) : (
                    <PanelLeft className="h-5 w-5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>{sidebarOpen ? 'Close' : 'Open'} sidebar</p>
              </TooltipContent>
            </Tooltip>
            <h1 className="text-lg font-semibold truncate">
              {currentConversation?.title || 'New Chat'}
            </h1>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                aria-label={mounted ? `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` : 'Toggle theme'}
              >
                {mounted ? (
                  theme === 'light' ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{mounted ? `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` : 'Toggle theme'}</p>
            </TooltipContent>
          </Tooltip>
        </header>

        {/* Messages */}
        <MessageList
          messages={messages}
          isStreaming={isStreaming}
          onSendSuggestion={handleSendSuggestion}
        />

        {/* Input */}
        <InputArea
          onSend={handleSend}
          onStop={stop}
          isStreaming={isStreaming}
          isRecording={isRecording}
          isTranscribing={isTranscribing}
          formattedDuration={formattedDuration}
          onStartRecording={startRecording}
          onStopRecording={stopRecording}
          transcribedText={transcribedText}
        />
      </div>
    </div>
  );
}
