import { useEffect, useRef } from 'react';
import { MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageItem } from './message-item';
import type { UIMessage } from 'ai';

interface MessageListProps {
  messages: UIMessage[];
  isStreaming: boolean;
  onSendSuggestion?: (text: string) => void;
}

export function MessageList({ messages, isStreaming, onSendSuggestion }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
          <MessageCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Welcome to your AI Assistant</h2>
        <p className="text-muted-foreground max-w-md">
          I can help you work with Notion and discover podcasts and videos. Start a conversation to get going!
        </p>
        <div className="mt-8 grid gap-2 max-w-sm w-full">
          {[
            'What can you help me with?',
            'Show me recent Notion updates',
            'Recommend some tech podcasts',
          ].map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => onSendSuggestion?.(suggestion)}
              className="text-left px-4 py-3 rounded-lg border border-border hover:bg-accent hover:border-primary/20 transition-colors text-sm"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1" ref={scrollRef}>
      <div className="mx-auto max-w-3xl py-4">
        {messages.map((message, index) => (
          <MessageItem
            key={message.id}
            message={message}
            isStreaming={isStreaming && index === messages.length - 1 && message.role === 'assistant'}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>
    </ScrollArea>
  );
}
