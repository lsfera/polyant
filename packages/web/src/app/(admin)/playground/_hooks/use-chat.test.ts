// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import {
  chatReducer,
  createInitialState,
  type ChatState,
  type ChatAction,
} from "./use-chat";

// Mock crypto.randomUUID for deterministic tests
vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });

function makeState(overrides: Partial<ChatState> = {}): ChatState {
  return { ...createInitialState("test-instance"), ...overrides };
}

describe("createInitialState", () => {
  it("creates state with correct defaults", () => {
    const state = createInitialState("my-slug");
    expect(state.messages).toEqual([]);
    expect(state.isStreaming).toBe(false);
    expect(state.error).toBeNull();
    expect(state.conversationId).toBeNull();
    expect(state.instanceSlug).toBe("my-slug");
    expect(state.chatId).toBe("test-uuid");
  });
});

describe("chatReducer", () => {
  describe("SEND_MESSAGE", () => {
    it("adds user and assistant messages", () => {
      const state = makeState();
      const next = chatReducer(state, { type: "SEND_MESSAGE", text: "Hello" });

      expect(next.messages).toHaveLength(2);
      expect(next.messages[0].role).toBe("user");
      expect(next.messages[0].content).toBe("Hello");
      expect(next.messages[0].isStreaming).toBe(false);
      expect(next.messages[1].role).toBe("assistant");
      expect(next.messages[1].content).toBe("");
      expect(next.messages[1].isStreaming).toBe(true);
      expect(next.isStreaming).toBe(true);
      expect(next.error).toBeNull();
    });

    it("clears previous error", () => {
      const state = makeState({ error: "previous error" });
      const next = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      expect(next.error).toBeNull();
    });
  });

  describe("APPEND_DELTA", () => {
    it("appends content to the streaming assistant message", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "APPEND_DELTA", content: "Hello" });
      state = chatReducer(state, { type: "APPEND_DELTA", content: " world" });

      const assistant = state.messages[1];
      expect(assistant.content).toBe("Hello world");
    });

    it("does nothing if last message is not a streaming assistant", () => {
      const state = makeState();
      const next = chatReducer(state, { type: "APPEND_DELTA", content: "x" });
      expect(next.messages).toHaveLength(0);
    });
  });

  describe("TOOL_CALL_START", () => {
    it("adds a running tool call to the assistant message", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "TOOL_CALL_START", toolName: "web_search" });

      const assistant = state.messages[1];
      expect(assistant.toolCalls).toHaveLength(1);
      expect(assistant.toolCalls[0]).toEqual({ name: "web_search", status: "running" });
    });
  });

  describe("TOOL_CALL_END", () => {
    it("marks the matching running tool as completed", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "TOOL_CALL_START", toolName: "web_search" });
      state = chatReducer(state, { type: "TOOL_CALL_END", toolName: "web_search" });

      const assistant = state.messages[1];
      expect(assistant.toolCalls[0].status).toBe("completed");
    });

    it("does not change other tool calls", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "TOOL_CALL_START", toolName: "tool_a" });
      state = chatReducer(state, { type: "TOOL_CALL_START", toolName: "tool_b" });
      state = chatReducer(state, { type: "TOOL_CALL_END", toolName: "tool_a" });

      const assistant = state.messages[1];
      expect(assistant.toolCalls[0].status).toBe("completed");
      expect(assistant.toolCalls[1].status).toBe("running");
    });
  });

  describe("STREAM_DONE", () => {
    it("stops streaming and sets createdAt on streaming messages", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "STREAM_DONE" });

      expect(state.isStreaming).toBe(false);
      expect(state.messages[1].isStreaming).toBe(false);
      expect(state.messages[1].createdAt).toBeTruthy();
    });
  });

  describe("STREAM_ERROR", () => {
    it("stops streaming and sets error", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "STREAM_ERROR", error: "Network failed" });

      expect(state.isStreaming).toBe(false);
      expect(state.error).toBe("Network failed");
      expect(state.messages[1].isStreaming).toBe(false);
    });
  });

  describe("LOAD_CONVERSATION", () => {
    it("loads messages and sets conversationId", () => {
      const state = makeState();
      const next = chatReducer(state, {
        type: "LOAD_CONVERSATION",
        messages: [
          {
            id: "m1",
            role: "user",
            content: "Hi",
            steps: null,
            reasoning: null,
            attachments: null,
            createdAt: "2024-01-01",
            promptTokens: null,
            completionTokens: null,
            metadata: null,
          },
          {
            id: "m2",
            role: "assistant",
            content: "Hello!",
            steps: null,
            reasoning: null,
            attachments: null,
            createdAt: "2024-01-01",
            promptTokens: null,
            completionTokens: null,
            metadata: null,
          },
        ],
        conversationId: "api-abc123",
      });

      expect(next.messages).toHaveLength(2);
      expect(next.messages[0].content).toBe("Hi");
      expect(next.messages[1].content).toBe("Hello!");
      expect(next.conversationId).toBe("api-abc123");
      expect(next.chatId).toBe("abc123");
      expect(next.isStreaming).toBe(false);
    });

    it("maps tool calls from stored format", () => {
      const state = makeState();
      const next = chatReducer(state, {
        type: "LOAD_CONVERSATION",
        messages: [
          {
            id: "m1",
            role: "assistant",
            content: "Done",
            steps: [{ toolName: "search", args: { q: "test" }, result: "found" }],
            reasoning: null,
            attachments: null,
            createdAt: "2024-01-01",
            promptTokens: null,
            completionTokens: null,
            metadata: null,
          },
        ],
        conversationId: "conv-1",
      });

      expect(next.messages[0].toolCalls).toHaveLength(1);
      expect(next.messages[0].toolCalls[0].name).toBe("search");
      expect(next.messages[0].toolCalls[0].status).toBe("completed");
    });

    it("sets instanceSlug if provided", () => {
      const state = makeState({ instanceSlug: "old-slug" });
      const next = chatReducer(state, {
        type: "LOAD_CONVERSATION",
        messages: [],
        conversationId: "c1",
        instanceSlug: "new-slug",
      });
      expect(next.instanceSlug).toBe("new-slug");
    });
  });

  describe("NEW_CHAT", () => {
    it("resets messages and conversationId", () => {
      let state = makeState();
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "NEW_CHAT" });

      expect(state.messages).toHaveLength(0);
      expect(state.conversationId).toBeNull();
      expect(state.isStreaming).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe("SET_INSTANCE", () => {
    it("changes instance and clears messages", () => {
      let state = makeState({ instanceSlug: "old" });
      state = chatReducer(state, { type: "SEND_MESSAGE", text: "Hi" });
      state = chatReducer(state, { type: "SET_INSTANCE", slug: "new-instance" });

      expect(state.instanceSlug).toBe("new-instance");
      expect(state.messages).toHaveLength(0);
      expect(state.conversationId).toBeNull();
    });
  });

  describe("unknown action", () => {
    it("returns state unchanged", () => {
      const state = makeState();
      const next = chatReducer(state, { type: "UNKNOWN" } as unknown as ChatAction);
      expect(next).toBe(state);
    });
  });
});
