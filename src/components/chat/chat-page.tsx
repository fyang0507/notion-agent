import { useState, useCallback, useEffect } from 'react';
import { Menu, Sun, Moon, X, PanelLeftClose, PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sidebar } from './sidebar';
import { MessageList } from './message-list';
import { InputArea } from './input-area';
import { useConversations } from '@/hooks/use-conversations';
import { useChat } from '@/hooks/use-chat';
import { useVoiceRecorder } from '@/hooks/use-voice-recorder';
import { useTheme } from '@/hooks/use-theme';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

export function ChatPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [transcribedText, setTranscribedText] = useState<string | undefined>();
  const { theme, toggleTheme } = useTheme();

  // Close sidebar on mobile by default
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const {
    currentConversation,
    currentConversationId,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateLastMessage,
    getGroupedConversations,
  } = useConversations();

  const messages = currentConversation?.messages || [];

  const { isStreaming, sendMessage, stopGeneration } = useChat({
    onAddMessage: addMessage,
    onUpdateLastMessage: updateLastMessage,
    messages,
  });

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
    createConversation();
    if (isMobile) setSidebarOpen(false);
  };

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    if (isMobile) setSidebarOpen(false);
  };

  const handleSendSuggestion = (text: string) => {
    sendMessage(text);
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
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                {theme === 'light' ? (
                  <Moon className="h-5 w-5" />
                ) : (
                  <Sun className="h-5 w-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>Switch to {theme === 'light' ? 'dark' : 'light'} mode</p>
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
          onSend={sendMessage}
          onStop={stopGeneration}
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
