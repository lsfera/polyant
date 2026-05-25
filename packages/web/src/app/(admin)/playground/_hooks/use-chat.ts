// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useReducer, useCallback, useRef } from "react";
import {
  streamChatCompletion,
  type ChatMessage as SSEMessage,
} from "../_lib/stream-parser";
import { api, type ConversationMessage } from "@/lib/api";

// ── Types ───────────────────────────────────────────────────────────

export interface ToolCallStatus {
  name: string;
  status: "running" | "completed";
  args?: unknown;
  result?: unknown;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls: ToolCallStatus[];
  isStreaming: boolean;
  createdAt: string | null;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  error: string | null;
  chatId: string;
  conversationId: string | null;
  instanceSlug: string;
}

// ── Actions ─────────────────────────────────────────────────────────

export type ChatAction =
  | { type: "SEND_MESSAGE"; text: string }
  | { type: "APPEND_DELTA"; content: string }
  | { type: "TOOL_CALL_START"; toolName: string }
  | { type: "TOOL_CALL_END"; toolName: string }
  | { type: "STREAM_DONE" }
  | { type: "STREAM_ERROR"; error: string }
  | { type: "LOAD_CONVERSATION"; messages: ConversationMessage[]; conversationId: string; instanceSlug?: string }
  | { type: "NEW_CHAT" }
  | { type: "SET_INSTANCE"; slug: string };

// ── Reducer ─────────────────────────────────────────────────────────

function generateId(): string {
  return crypto.randomUUID();
}

export function createInitialState(instanceSlug: string): ChatState {
  return {
    messages: [],
    isStreaming: false,
    error: null,
    chatId: generateId(),
    conversationId: null,
    instanceSlug,
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "SEND_MESSAGE": {
      const now = new Date().toISOString();
      const userMsg: ChatMessage = {
        id: generateId(),
        role: "user",
        content: action.text,
        toolCalls: [],
        isStreaming: false,
        createdAt: now,
      };
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: "",
        toolCalls: [],
        isStreaming: true,
        createdAt: null,
      };
      return {
        ...state,
        messages: [...state.messages, userMsg, assistantMsg],
        isStreaming: true,
        error: null,
      };
    }

    case "APPEND_DELTA": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && last.isStreaming) {
        msgs[msgs.length - 1] = {
          ...last,
          content: last.content + action.content,
        };
      }
      return { ...state, messages: msgs };
    }

    case "TOOL_CALL_START": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && last.isStreaming) {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: [
            ...last.toolCalls,
            { name: action.toolName, status: "running" },
          ],
        };
      }
      return { ...state, messages: msgs };
    }

    case "TOOL_CALL_END": {
      const msgs = [...state.messages];
      const last = msgs[msgs.length - 1];
      if (last?.role === "assistant" && last.isStreaming) {
        msgs[msgs.length - 1] = {
          ...last,
          toolCalls: last.toolCalls.map((tc) =>
            tc.name === action.toolName && tc.status === "running"
              ? { ...tc, status: "completed" as const }
              : tc,
          ),
        };
      }
      return { ...state, messages: msgs };
    }

    case "STREAM_DONE": {
      const now = new Date().toISOString();
      const msgs = state.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false, createdAt: now } : msg,
      );
      return { ...state, messages: msgs, isStreaming: false };
    }

    case "STREAM_ERROR": {
      const msgs = state.messages.map((msg) =>
        msg.isStreaming ? { ...msg, isStreaming: false } : msg,
      );
      return {
        ...state,
        messages: msgs,
        isStreaming: false,
        error: action.error,
      };
    }

    case "LOAD_CONVERSATION": {
      const loaded: ChatMessage[] = action.messages.map((msg) => {
        // Map stored tool calls to ToolCallStatus (all completed, with full data)
        const toolCalls: ToolCallStatus[] =
          Array.isArray(msg.steps) && msg.steps.length > 0
            ? msg.steps.map((tc, i) => {
                const tool = tc as Record<string, unknown>;
                const name =
                  (tool.toolName as string) ??
                  (tool.tool as string) ??
                  `Tool ${i + 1}`;
                return {
                  name,
                  status: "completed" as const,
                  args: tool.args ?? undefined,
                  result: tool.result ?? undefined,
                };
              })
            : [];
        return {
          id: msg.id,
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
          toolCalls,
          isStreaming: false,
          createdAt: msg.createdAt ?? null,
        };
      });
      // Extract chatId from conversationId (format: api-{uuid})
      const chatId = action.conversationId.startsWith("api-")
        ? action.conversationId.slice(4)
        : action.conversationId;
      return {
        ...state,
        messages: loaded,
        conversationId: action.conversationId,
        chatId,
        // Set instanceSlug if provided (from conversation metadata)
        instanceSlug: action.instanceSlug ?? state.instanceSlug,
        isStreaming: false,
        error: null,
      };
    }

    case "NEW_CHAT":
      return {
        ...state,
        messages: [],
        chatId: generateId(),
        conversationId: null,
        isStreaming: false,
        error: null,
      };

    case "SET_INSTANCE":
      return {
        ...state,
        instanceSlug: action.slug,
        messages: [],
        chatId: generateId(),
        conversationId: null,
        isStreaming: false,
        error: null,
      };

    default:
      return state;
  }
}

// ── Hook ────────────────────────────────────────────────────────────

export function useChat(defaultInstanceSlug: string) {
  const [state, dispatch] = useReducer(
    chatReducer,
    defaultInstanceSlug,
    createInitialState,
  );
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    (text: string, authToken?: string) => {
      if (!text.trim() || state.isStreaming || !state.instanceSlug) return;

      dispatch({ type: "SEND_MESSAGE", text });

      // Build message history for the API
      const history: SSEMessage[] = state.messages
        .filter((m) => m.content.trim())
        .map((m) => ({ role: m.role, content: m.content }));
      history.push({ role: "user", content: text });

      const controller = new AbortController();
      abortRef.current = controller;

      streamChatCompletion(
        {
          model: state.instanceSlug,
          messages: history,
          chatId: state.chatId,
          signal: controller.signal,
          authToken,
        },
        {
          onDelta: (content) => dispatch({ type: "APPEND_DELTA", content }),
          onToolCallStart: (toolName) =>
            dispatch({ type: "TOOL_CALL_START", toolName }),
          onToolCallEnd: (toolName) =>
            dispatch({ type: "TOOL_CALL_END", toolName }),
          onDone: () => {
            dispatch({ type: "STREAM_DONE" });
            abortRef.current = null;
          },
          onError: (error) => {
            dispatch({ type: "STREAM_ERROR", error: error.message });
            abortRef.current = null;
          },
        },
      );
    },
    [state.isStreaming, state.instanceSlug, state.messages, state.chatId],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "STREAM_DONE" });
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "NEW_CHAT" });
  }, []);

  const loadConversation = useCallback(async (conversationId: string, instanceSlug?: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    try {
      // Derive the instance scope from the explicit arg, or fall back to
      // parsing the conversation id (`<instanceSlug>:<channel>:<id>`).
      const scope = instanceSlug ?? conversationId.split(":")[0] ?? "";
      const result = await api.conversations.messages(conversationId, scope, {
        limit: 100,
      });
      dispatch({
        type: "LOAD_CONVERSATION",
        messages: result.messages,
        conversationId,
        instanceSlug,
      });
    } catch {
      dispatch({
        type: "STREAM_ERROR",
        error: "Failed to load conversation",
      });
    }
  }, []);

  const setInstance = useCallback((slug: string) => {
    abortRef.current?.abort();
    abortRef.current = null;
    dispatch({ type: "SET_INSTANCE", slug });
  }, []);

  return {
    state,
    sendMessage,
    stopStreaming,
    newChat,
    loadConversation,
    setInstance,
  };
}
