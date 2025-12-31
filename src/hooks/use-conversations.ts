import { useState, useEffect, useCallback } from 'react';
import type { UIMessage } from 'ai';

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface ConversationGroup {
  label: string;
  conversations: Conversation[];
}

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<UIMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load conversations list on mount
  useEffect(() => {
    fetch('/api/conversations')
      .then((res) => res.json())
      .then((data: Conversation[]) => {
        setConversations(data);
        if (data.length > 0) {
          setCurrentConversationId(data[0].id);
        }
        setIsLoading(false);
      })
      .catch((error) => {
        console.error('Failed to load conversations:', error);
        setIsLoading(false);
      });
  }, []);

  // Load messages when conversation changes
  useEffect(() => {
    if (!currentConversationId) {
      setCurrentMessages([]);
      return;
    }

    fetch(`/api/conversations/${currentConversationId}`)
      .then((res) => res.json())
      .then((data) => setCurrentMessages(data.messages || []))
      .catch((error) => {
        console.error('Failed to load messages:', error);
        setCurrentMessages([]);
      });
  }, [currentConversationId]);

  const currentConversation = conversations.find((c) => c.id === currentConversationId) || null;

  const createConversation = useCallback(async () => {
    // Check if there's already an empty conversation
    if (currentConversation && currentMessages.length === 0) {
      return currentConversation;
    }

    const res = await fetch('/api/conversations', { method: 'POST' });
    const newConv: Conversation = await res.json();

    setConversations((prev) => [newConv, ...prev]);
    setCurrentConversationId(newConv.id);
    setCurrentMessages([]);

    return newConv;
  }, [currentConversation, currentMessages.length]);

  const switchConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
  }, []);

  const deleteConversation = useCallback(
    async (id: string) => {
      await fetch(`/api/conversations/${id}`, { method: 'DELETE' });

      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);

        if (currentConversationId === id) {
          const newId = filtered.length > 0 ? filtered[0].id : null;
          setCurrentConversationId(newId);
        }

        return filtered;
      });
    },
    [currentConversationId]
  );

  const renameConversation = useCallback(async (id: string, title: string) => {
    await fetch(`/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });

    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, title } : c)));
  }, []);

  // Refresh conversation list (called after messages are sent)
  const refreshConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    const data: Conversation[] = await res.json();
    setConversations(data);
  }, []);

  const getGroupedConversations = useCallback((): ConversationGroup[] => {
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;
    const lastMonth = today - 30 * 86400000;

    const groups: Record<string, Conversation[]> = {
      Today: [],
      Yesterday: [],
      'Last 7 Days': [],
      'Last 30 Days': [],
      Older: [],
    };

    const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

    sortedConversations.forEach((conv) => {
      const date = conv.updatedAt;
      if (date >= today) {
        groups['Today'].push(conv);
      } else if (date >= yesterday) {
        groups['Yesterday'].push(conv);
      } else if (date >= lastWeek) {
        groups['Last 7 Days'].push(conv);
      } else if (date >= lastMonth) {
        groups['Last 30 Days'].push(conv);
      } else {
        groups['Older'].push(conv);
      }
    });

    return Object.entries(groups)
      .filter(([_, convs]) => convs.length > 0)
      .map(([label, convs]) => ({ label, conversations: convs }));
  }, [conversations]);

  return {
    conversations,
    currentConversation,
    currentConversationId,
    currentMessages,
    isLoading,
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    refreshConversations,
    getGroupedConversations,
  };
}
