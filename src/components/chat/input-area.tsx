import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Send, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { VoiceRecorder } from './voice-recorder';
import { cn } from '@/lib/utils';

interface InputAreaProps {
  onSend: (message: string) => void;
  onStop: () => void;
  isStreaming: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  formattedDuration: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  transcribedText?: string;
}

export function InputArea({
  onSend,
  onStop,
  isStreaming,
  isRecording,
  isTranscribing,
  formattedDuration,
  onStartRecording,
  onStopRecording,
  transcribedText,
}: InputAreaProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (transcribedText) {
      setInput(prev => prev ? `${prev} ${transcribedText}` : transcribedText);
    }
  }, [transcribedText]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      onSend(input.trim());
      setInput('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border bg-background px-4 py-3">
      <div className="mx-auto max-w-3xl">
        <div
          className={cn(
            "flex items-end gap-2 rounded-xl border border-input bg-background p-2",
            "focus-within:ring-1 focus-within:ring-ring",
            "transition-shadow duration-200"
          )}
        >
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message your assistant..."
            disabled={isStreaming || isRecording}
            className={cn(
              "min-h-[40px] max-h-[200px] flex-1 resize-none border-0 bg-transparent",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-muted-foreground/60"
            )}
            rows={1}
          />

          <VoiceRecorder
            isRecording={isRecording}
            isTranscribing={isTranscribing}
            formattedDuration={formattedDuration}
            onStartRecording={onStartRecording}
            onStopRecording={onStopRecording}
            disabled={isStreaming}
          />

          {isStreaming ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onStop}
              className="h-9 w-9 rounded-full hover:bg-accent"
              aria-label="Stop generation"
            >
              <Square className="h-4 w-4 fill-current" />
            </Button>
          ) : (
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isRecording || isTranscribing}
              className={cn(
                "h-9 w-9 rounded-full",
                "disabled:opacity-50"
              )}
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
