import { useState } from 'react';
import { Copy, Check, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Message } from '@/lib/types';
import { cn } from '@/lib/utils';

interface MessageItemProps {
  message: Message;
  isStreaming?: boolean;
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderContent = (content: string) => {
    const parts = content.split(/(```[\s\S]*?```|\*\*.*?\*\*|\*.*?\*|`.*?`)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <div key={index} className="relative my-3 group">
            <pre className="overflow-x-auto rounded-lg bg-muted p-4 text-sm">
              <code>{code}</code>
            </pre>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigator.clipboard.writeText(code)}
              className="absolute right-2 top-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      }
      
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      
      if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }
      
      if (part.startsWith('`') && part.endsWith('`') && !part.startsWith('```')) {
        return (
          <code key={index} className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">
            {part.slice(1, -1)}
          </code>
        );
      }

      // Handle line breaks and lists
      return part.split('\n').map((line, lineIndex) => {
        const listMatch = line.match(/^(\d+\.|[-•]) (.+)/);
        if (listMatch) {
          return (
            <div key={`${index}-${lineIndex}`} className="flex gap-2 my-0.5">
              <span className="text-muted-foreground">{listMatch[1]}</span>
              <span>{listMatch[2]}</span>
            </div>
          );
        }
        return lineIndex > 0 ? (
          <span key={`${index}-${lineIndex}`}>
            <br />
            {line}
          </span>
        ) : (
          <span key={`${index}-${lineIndex}`}>{line}</span>
        );
      });
    });
  };

  return (
    <div
      className={cn(
        "group flex gap-3 px-4 py-4 message-appear",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}
      
      <div
        className={cn(
          "relative max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-chat-user text-foreground rounded-br-md"
            : "bg-chat-assistant border border-chat-border rounded-bl-md"
        )}
      >
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {message.content ? (
            renderContent(message.content)
          ) : isStreaming ? (
            <div className="flex items-center gap-1">
              <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
              <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
            </div>
          ) : null}
        </div>
        
        <div className="mt-1 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(message.timestamp)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>{new Date(message.timestamp).toLocaleString()}</p>
            </TooltipContent>
          </Tooltip>
          
          {!isUser && message.content && (
            <Button
              variant="ghost"
              size="icon"
              onClick={copyToClipboard}
              className="h-6 w-6"
            >
              {copied ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : (
                <Copy className="h-3 w-3" />
              )}
            </Button>
          )}
        </div>
      </div>
      
      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
