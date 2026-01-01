import React, { useState } from 'react';
import { Copy, Check, Bot, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToolCard } from './tool-card';
import { cn } from '@/lib/utils';
import type { UIMessage } from 'ai';

interface MessageItemProps {
  message: UIMessage;
  isStreaming?: boolean;
}

// Helper to truncate URL for display (domain + path hint)
function truncateUrl(url: string, maxLength = 40): string {
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname + parsed.search;

    if (path === '/' || path === '') {
      return domain;
    }

    const full = domain + path;
    if (full.length <= maxLength) {
      return full;
    }

    // Truncate path but keep domain visible
    const availableForPath = maxLength - domain.length - 3; // 3 for "..."
    if (availableForPath > 5) {
      return domain + path.slice(0, availableForPath) + '...';
    }
    return domain + '/...';
  } catch {
    // If URL parsing fails, just truncate the string
    return url.length > maxLength ? url.slice(0, maxLength - 3) + '...' : url;
  }
}

// Type guard for tool parts - they have type starting with 'tool-' but not 'tool-invocation'
function isToolPart(
  part: UIMessage['parts'][number]
): part is UIMessage['parts'][number] & {
  type: `tool-${string}`;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
} {
  return typeof part.type === 'string' && part.type.startsWith('tool-');
}

export function MessageItem({ message, isStreaming }: MessageItemProps) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  // Get text content from parts
  const textContent =
    message.parts
      ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
      .map((part) => part.text)
      .join('') || '';

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderInlineFormatting = (text: string, keyPrefix: string): React.ReactNode[] => {
    // Split by formatting markers AND URLs
    // URL regex: matches http:// or https:// followed by non-whitespace characters
    const urlPattern = /(https?:\/\/[^\s<>[\]()]+)/g;
    const formattingPattern = /(\*\*.*?\*\*|\*.*?\*|`.*?`)/g;

    // First split by URLs, then by formatting within non-URL parts
    const urlParts = text.split(urlPattern);

    return urlParts.flatMap((urlPart, urlIndex) => {
      // Check if this part is a URL
      if (urlPart.match(/^https?:\/\//)) {
        return (
          <a
            key={`${keyPrefix}-url-${urlIndex}`}
            href={urlPart}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
            title={urlPart}
          >
            {truncateUrl(urlPart)}
          </a>
        );
      }

      // For non-URL parts, apply formatting
      const formattingParts = urlPart.split(formattingPattern);

      return formattingParts.map((part, index) => {
        const key = `${keyPrefix}-${urlIndex}-${index}`;

        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={key}>{part.slice(2, -2)}</strong>;
        }

        if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
          return <em key={key}>{part.slice(1, -1)}</em>;
        }

        if (part.startsWith('`') && part.endsWith('`')) {
          return (
            <code
              key={key}
              className="rounded bg-muted px-1.5 py-0.5 text-sm font-mono"
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        return <span key={key}>{part}</span>;
      });
    });
  };

  const renderTextContent = (content: string) => {
    // First, split by code blocks
    const codeBlockParts = content.split(/(```[\s\S]*?```)/g);

    return codeBlockParts.map((part, partIndex) => {
      // Handle code blocks
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return (
          <div key={partIndex} className="relative my-3 group">
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

      // Handle regular text: split by lines first, then apply inline formatting
      const lines = part.split('\n');
      return lines.map((line, lineIndex) => {
        const key = `${partIndex}-${lineIndex}`;

        // Check for ordered list items (1. 2. etc) - allow leading whitespace
        const orderedMatch = line.match(/^\s*(\d+)\.\s+(.+)/);
        if (orderedMatch) {
          return (
            <div key={key} className="flex gap-2.5 py-1">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary leading-none">
                {orderedMatch[1]}
              </span>
              <span className="flex-1" style={{ lineHeight: '1.8' }}>{renderInlineFormatting(orderedMatch[2], key)}</span>
            </div>
          );
        }

        // Check for unordered list items - match various dash/bullet characters
        const unorderedMatch = line.match(/^\s*[-–—•*]\s+(.+)/);
        if (unorderedMatch) {
          return (
            <div key={key} className="flex gap-2.5 py-0.5">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/50" />
              <span className="flex-1" style={{ lineHeight: '1.8' }}>{renderInlineFormatting(unorderedMatch[1], key)}</span>
            </div>
          );
        }

        // Check for blockquote
        const blockquoteMatch = line.match(/^\s*>\s*(.*)/);
        if (blockquoteMatch) {
          return (
            <blockquote
              key={key}
              className="border-l-2 border-primary/30 pl-3 py-1 text-muted-foreground italic"
              style={{ lineHeight: '1.8' }}
            >
              {renderInlineFormatting(blockquoteMatch[1], key)}
            </blockquote>
          );
        }

        // Empty line - render as paragraph break (with visual spacing)
        if (line.trim() === '') {
          return <div key={key} className="h-3" />;
        }

        // Check if previous line was a block element - no extra br needed
        const prevLine = lineIndex > 0 ? lines[lineIndex - 1] : '';
        const prevWasListItem = prevLine.match(/^\s*(\d+)\.\s+.+/) || prevLine.match(/^\s*[-–—•*]\s+.+/);
        const prevWasBlockquote = prevLine.match(/^\s*>\s*.*/);
        const prevWasEmpty = prevLine.trim() === '';

        // Add line break before regular text if:
        // - Not the first line
        // - Previous line was not empty (empty line already provides break)
        // - Previous line was not a block element (block elements provide break)
        const needsBreak = lineIndex > 0 && !prevWasEmpty && !prevWasListItem && !prevWasBlockquote;

        return (
          <span key={key} style={{ lineHeight: '1.8' }}>
            {needsBreak && <br />}
            {renderInlineFormatting(line, key)}
          </span>
        );
      });
    });
  };

  const renderParts = () => {
    if (!message.parts || message.parts.length === 0) {
      if (isStreaming) {
        return (
          <div className="flex items-center gap-1">
            <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="typing-dot h-2 w-2 rounded-full bg-muted-foreground" />
          </div>
        );
      }
      return null;
    }

    return message.parts.map((part, index) => {
      if (part.type === 'text') {
        return (
          <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
            {renderTextContent(part.text)}
          </div>
        );
      }

      // Handle tool parts (type starts with 'tool-')
      if (isToolPart(part)) {
        // Extract tool name from type (e.g., 'tool-shell' -> 'shell')
        const toolName = part.type.replace(/^tool-/, '');
        return (
          <ToolCard
            key={index}
            toolName={toolName}
            state={part.state}
            input={part.input as Record<string, unknown> | undefined}
            output={part.output}
          />
        );
      }

      return null;
    });
  };

  return (
    <div
      className={cn(
        'group flex gap-3 px-4 py-4 message-appear',
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          'relative max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3',
          isUser
            ? 'bg-chat-user text-foreground rounded-br-md'
            : 'bg-chat-assistant border border-chat-border rounded-bl-md'
        )}
      >
        <div className="space-y-2">{renderParts()}</div>

        {/* Copy button - absolutely positioned to not affect layout */}
        {!isUser && textContent && (
          <Button
            variant="ghost"
            size="icon"
            onClick={copyToClipboard}
            className="absolute -bottom-1 -right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <Copy className="h-3 w-3 text-muted-foreground" />
            )}
          </Button>
        )}
      </div>

      {isUser && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}
