// SPDX-License-Identifier: AGPL-3.0-or-later

import { API_BASE } from "@/lib/api";

export interface StreamCallbacks {
  onDelta: (content: string) => void;
  onToolCallStart: (toolName: string) => void;
  onToolCallEnd: (toolName: string) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface StreamRequestOptions {
  model: string;
  messages: ChatMessage[];
  chatId: string;
  signal?: AbortSignal;
  authToken?: string;
}

/**
 * Streams a chat completion from the OpenAI-compatible API.
 * Parses SSE chunks and extracts tool calls from <think> blocks.
 */
export async function streamChatCompletion(
  options: StreamRequestOptions,
  callbacks: StreamCallbacks,
): Promise<void> {
  const { model, messages, chatId, signal, authToken } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        chat_id: chatId,
      }),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error("Network error"));
    return;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    callbacks.onError(new Error(`HTTP ${response.status}: ${body}`));
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    callbacks.onError(new Error("No response body"));
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let insideThink = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // Process complete SSE events (separated by double newlines)
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);

          if (data === "[DONE]") {
            callbacks.onDone();
            return;
          }

          try {
            const chunk = JSON.parse(data);
            const content = chunk.choices?.[0]?.delta?.content;
            if (typeof content !== "string" || content === "") continue;

            processContent(content, insideThink, callbacks, (v) => {
              insideThink = v;
            });
          } catch {
            // Skip malformed JSON chunks
          }
        }
      }
    }

    // Handle any remaining buffer
    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (line.startsWith("data: ") && line.slice(6) === "[DONE]") {
          callbacks.onDone();
          return;
        }
      }
    }

    callbacks.onDone();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error("Stream read error"));
  }
}

/**
 * Processes streamed content, handling <think> block transitions
 * and extracting tool call indicators.
 */
export function processContent(
  content: string,
  insideThink: boolean,
  callbacks: StreamCallbacks,
  setInsideThink: (v: boolean) => void,
): void {
  // Content may arrive in fragments across chunk boundaries.
  // The engine sends <think>\n, </think>\n, and tool lines as discrete chunks,
  // so we can check for them directly.

  if (content.includes("<think>")) {
    setInsideThink(true);
    // Anything after <think> in this chunk is inside the think block
    const after = content.split("<think>").pop() ?? "";
    if (after.trim()) {
      processThinkContent(after, callbacks);
    }
    return;
  }

  if (content.includes("</think>")) {
    setInsideThink(false);
    // Anything after </think> is regular content
    const after = content.split("</think>").pop() ?? "";
    if (after.trim()) {
      callbacks.onDelta(after);
    }
    return;
  }

  if (insideThink) {
    processThinkContent(content, callbacks);
    return;
  }

  callbacks.onDelta(content);
}

/**
 * Parses content inside <think> blocks for tool call indicators.
 */
export function processThinkContent(
  content: string,
  callbacks: StreamCallbacks,
): void {
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // ⏳ toolName...
    const startMatch = trimmed.match(/^⏳\s+(.+?)\.{3}$/);
    if (startMatch) {
      callbacks.onToolCallStart(startMatch[1]);
      continue;
    }

    // ✓ toolName
    const endMatch = trimmed.match(/^✓\s+(.+)$/);
    if (endMatch) {
      callbacks.onToolCallEnd(endMatch[1]);
    }
  }
}
