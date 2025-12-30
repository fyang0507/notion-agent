import { useState, useCallback, useRef } from 'react';
import { Message } from '@/lib/types';

interface UseChatOptions {
  onAddMessage: (message: Omit<Message, 'id' | 'timestamp'>) => Message;
  onUpdateLastMessage: (content: string) => void;
  messages: Message[];
}

export function useChat({ onAddMessage, onUpdateLastMessage, messages }: UseChatOptions) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    // Add user message
    onAddMessage({ role: 'user', content });

    // Add empty assistant message
    onAddMessage({ role: 'assistant', content: '' });

    setIsStreaming(true);
    setStreamingContent('');

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    try {
      // Call the real /api/chat endpoint with streaming
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            ...messages,
            { role: 'user', content }
          ],
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      // Stream the response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedContent += chunk;

        setStreamingContent(accumulatedContent);
        onUpdateLastMessage(accumulatedContent);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      } else {
        console.error('Chat error:', error);
        onUpdateLastMessage('Sorry, something went wrong. Please try again.');
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent('');
      abortControllerRef.current = null;
    }
  }, [isStreaming, onAddMessage, onUpdateLastMessage, messages]);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
  }, []);

  return {
    isStreaming,
    streamingContent,
    sendMessage,
    stopGeneration,
  };
}
