import { useState, useEffect, useCallback, useRef } from 'react';
import { Conversation, Message, ConversationGroup } from '@/lib/types';
import { loadConversations, saveConversations, generateId, generateTitle } from '@/lib/storage';

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  // Ref to track current conversation ID synchronously (for back-to-back addMessage calls)
  const currentIdRef = useRef<string | null>(null);

  useEffect(() => {
    const loaded = loadConversations();
    setConversations(loaded);
    if (loaded.length > 0) {
      setCurrentConversationId(loaded[0].id);
      currentIdRef.current = loaded[0].id;
    }
  }, []);

  useEffect(() => {
    if (conversations.length > 0) {
      saveConversations(conversations);
    }
  }, [conversations]);

  const currentConversation = conversations.find(c => c.id === currentConversationId) || null;

  const createConversation = useCallback(() => {
    // Check if there's already an empty conversation - prevent creating duplicates
    const existingEmpty = conversations.find(c => c.messages.length === 0);
    if (existingEmpty) {
      setCurrentConversationId(existingEmpty.id);
      currentIdRef.current = existingEmpty.id;
      return existingEmpty;
    }

    const newConversation: Conversation = {
      id: generateId(),
      title: 'New conversation',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
    currentIdRef.current = newConversation.id;
    return newConversation;
  }, [conversations]);

  const switchConversation = useCallback((id: string) => {
    setCurrentConversationId(id);
    currentIdRef.current = id;
  }, []);

  const deleteConversation = useCallback((id: string) => {
    setConversations(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (currentIdRef.current === id) {
        const newId = filtered.length > 0 ? filtered[0].id : null;
        setCurrentConversationId(newId);
        currentIdRef.current = newId;
      }
      if (filtered.length === 0) {
        localStorage.removeItem('notion-assistant-conversations');
      }
      return filtered;
    });
  }, []);

  const renameConversation = useCallback((id: string, newTitle: string) => {
    setConversations(prev =>
      prev.map(c =>
        c.id === id ? { ...c, title: newTitle, updatedAt: Date.now() } : c
      )
    );
  }, []);

  const addMessage = useCallback((message: Omit<Message, 'id' | 'timestamp'>) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: Date.now(),
    };

    // Use the ref for synchronous access to current conversation ID
    const activeConversationId = currentIdRef.current;

    // Track if we need to update currentConversationId after setConversations
    let newConversationId: string | null = null;

    setConversations(prev => {
      // If no current conversation, find an empty one or create new
      if (!activeConversationId) {
        const existingEmpty = prev.find(c => c.messages.length === 0);
        if (existingEmpty) {
          // Use existing empty conversation - track the ID to set after
          newConversationId = existingEmpty.id;
          currentIdRef.current = existingEmpty.id;
          return prev.map(c => {
            if (c.id !== existingEmpty.id) return c;
            return {
              ...c,
              messages: [newMessage],
              title: message.role === 'user' ? generateTitle(message.content) : c.title,
              updatedAt: Date.now(),
            };
          });
        }

        // Create new conversation
        const newConversation: Conversation = {
          id: generateId(),
          title: message.role === 'user' ? generateTitle(message.content) : 'New conversation',
          messages: [newMessage],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        // Track the ID to set after
        newConversationId = newConversation.id;
        currentIdRef.current = newConversation.id;
        return [newConversation, ...prev];
      }

      return prev.map(c => {
        if (c.id !== activeConversationId) return c;

        const updated = {
          ...c,
          messages: [...c.messages, newMessage],
          updatedAt: Date.now(),
        };

        if (c.messages.length === 0 && message.role === 'user') {
          updated.title = generateTitle(message.content);
        }

        return updated;
      });
    });

    // Set currentConversationId outside setConversations to ensure proper batching
    if (newConversationId) {
      setCurrentConversationId(newConversationId);
    }

    return newMessage;
  }, []);

  const updateLastMessage = useCallback((content: string) => {
    const activeConversationId = currentIdRef.current;
    setConversations(prev =>
      prev.map(c => {
        if (c.id !== activeConversationId) return c;
        const messages = [...c.messages];
        if (messages.length > 0) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            content,
          };
        }
        return { ...c, messages, updatedAt: Date.now() };
      })
    );
  }, []);

  const getGroupedConversations = useCallback((): ConversationGroup[] => {
    const now = Date.now();
    const today = new Date().setHours(0, 0, 0, 0);
    const yesterday = today - 86400000;
    const lastWeek = today - 7 * 86400000;
    const lastMonth = today - 30 * 86400000;

    const groups: Record<string, Conversation[]> = {
      'Today': [],
      'Yesterday': [],
      'Last 7 Days': [],
      'Last 30 Days': [],
      'Older': [],
    };

    const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

    sortedConversations.forEach(conv => {
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
    createConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    addMessage,
    updateLastMessage,
    getGroupedConversations,
  };
}
