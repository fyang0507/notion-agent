import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  isRecording: boolean;
  isTranscribing: boolean;
  formattedDuration: string;
  onStartRecording: () => void;
  onStopRecording: () => void;
  disabled?: boolean;
}

export function VoiceRecorder({
  isRecording,
  isTranscribing,
  formattedDuration,
  onStartRecording,
  onStopRecording,
  disabled,
}: VoiceRecorderProps) {
  if (isTranscribing) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Transcribing...</span>
      </div>
    );
  }

  if (isRecording) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onStopRecording}
          className={cn(
            "h-9 w-9 rounded-full bg-recording text-primary-foreground recording-pulse",
            "hover:bg-recording/90"
          )}
          aria-label="Stop recording"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
        <span className="text-xs font-medium text-recording tabular-nums">
          {formattedDuration}
        </span>
      </div>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          onClick={onStartRecording}
          disabled={disabled}
          className="h-9 w-9 rounded-full"
          aria-label="Start voice recording"
        >
          <Mic className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">
        <p>Click to record</p>
      </TooltipContent>
    </Tooltip>
  );
}
