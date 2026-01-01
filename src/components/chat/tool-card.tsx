import { useState } from 'react';
import { ChevronDown, ChevronUp, Wrench, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

// AI SDK tool invocation states
type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'
  | 'approval-requested'
  | 'approval-responded';

interface ToolCardProps {
  toolName: string;
  state: ToolState | string;
  input?: Record<string, unknown>;
  output?: unknown;
}

export function ToolCard({ toolName, state, input, output }: ToolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const isComplete = state === 'output-available';
  const isStreaming = state === 'input-streaming';
  const isError = state === 'output-error';

  return (
    <div
      className={`my-2 rounded-lg border p-3 ${
        isError
          ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950'
          : isComplete
            ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
            : 'border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950'
      }`}
    >
      <div className="flex items-center gap-2">
        {isStreaming ? (
          <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
        ) : isError ? (
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : isComplete ? (
          <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
        ) : (
          <Wrench className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        )}
        <span className="font-medium text-sm">{formatToolName(toolName)}</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-2 space-y-2 text-xs">
          {input && Object.keys(input).length > 0 && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Input:</div>
              <pre className="overflow-x-auto bg-white/50 dark:bg-black/20 p-2 rounded text-xs whitespace-pre-wrap break-words">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {output !== undefined && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Output:</div>
              <pre className="overflow-x-auto bg-white/50 dark:bg-black/20 p-2 rounded max-h-48 text-xs whitespace-pre-wrap break-words overflow-y-auto">
                {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatToolName(name: string): string {
  // Convert snake_case or camelCase to Title Case
  return name
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
