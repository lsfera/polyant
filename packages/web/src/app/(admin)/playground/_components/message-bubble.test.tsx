// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import type { ChatMessage } from "../_hooks/use-chat";

// Mock MarkdownRenderer to render content as plain text
vi.mock("./markdown-renderer", () => ({
  MarkdownRenderer: ({ content }: { content: string }) => (
    <div data-testid="markdown-renderer">{content}</div>
  ),
}));

// Mock ToolCallIndicator
vi.mock("./tool-call-indicator", () => ({
  ToolCallIndicator: ({ toolCalls }: { toolCalls: unknown[] }) => (
    <div data-testid="tool-call-indicator">{toolCalls.length} tools</div>
  ),
}));

// Mock radix-ui Accordion used inside message-bubble
vi.mock("@/components/ui/accordion", () => ({
  Accordion: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion">{children}</div>
  ),
  AccordionItem: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-item">{children}</div>
  ),
  AccordionTrigger: ({ children }: { children: React.ReactNode }) => (
    <button data-testid="accordion-trigger">{children}</button>
  ),
  AccordionContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="accordion-content">{children}</div>
  ),
}));

import { MessageBubble } from "./message-bubble";

function makeMessage(overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello there",
    toolCalls: [],
    isStreaming: false,
    createdAt: "2026-02-23T10:30:00Z",
    ...overrides,
  };
}

describe("MessageBubble", () => {
  // ── Layout / role-based styling ───────────────────────────────────

  it("renders user message aligned to the right", () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: "user" })} />,
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toContain("justify-end");
  });

  it("renders assistant message aligned to the left", () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: "assistant" })} />,
    );
    const outer = container.firstElementChild;
    expect(outer?.className).toContain("justify-start");
  });

  it("applies primary background to user messages", () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: "user" })} />,
    );
    const bubble = container.firstElementChild?.firstElementChild;
    expect(bubble?.className).toContain("bg-primary");
    expect(bubble?.className).toContain("text-primary-foreground");
  });

  it("applies muted background to assistant messages", () => {
    const { container } = render(
      <MessageBubble message={makeMessage({ role: "assistant" })} />,
    );
    const bubble = container.firstElementChild?.firstElementChild;
    expect(bubble?.className).toContain("bg-muted");
    expect(bubble?.className).not.toContain("bg-primary");
  });

  // ── Content rendering ─────────────────────────────────────────────

  it("renders user message content as plain text in a <p>", () => {
    render(
      <MessageBubble message={makeMessage({ role: "user", content: "Hi!" })} />,
    );
    const p = screen.getByText("Hi!");
    expect(p.tagName).toBe("P");
  });

  it("renders assistant message content through MarkdownRenderer", () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "Hello from AI",
        })}
      />,
    );
    const md = screen.getByTestId("markdown-renderer");
    expect(md).toHaveTextContent("Hello from AI");
  });

  // ── Streaming state ───────────────────────────────────────────────

  it("shows loading dots when assistant is streaming with no content", () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "",
          isStreaming: true,
          createdAt: null,
        })}
      />,
    );
    // The three bounce dots are <span> elements with animate-bounce class
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(3);
  });

  it("does not show loading dots when assistant has content even while streaming", () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "Partial response",
          isStreaming: true,
        })}
      />,
    );
    const dots = container.querySelectorAll(".animate-bounce");
    expect(dots.length).toBe(0);
    expect(screen.getByTestId("markdown-renderer")).toHaveTextContent(
      "Partial response",
    );
  });

  // ── Timestamp ─────────────────────────────────────────────────────

  it("displays formatted timestamp when createdAt is set and not streaming", () => {
    render(
      <MessageBubble
        message={makeMessage({
          createdAt: "2026-02-23T14:05:30Z",
          isStreaming: false,
        })}
      />,
    );
    // formatTime uses toLocaleTimeString with hour, minute, second
    // The exact format depends on locale, but it should contain "05" (minutes) somewhere
    const timeEl = screen.getByText(/\d{1,2}:\d{2}:\d{2}/);
    expect(timeEl).toBeInTheDocument();
  });

  it("does not display timestamp while streaming", () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({
          createdAt: "2026-02-23T14:05:30Z",
          isStreaming: true,
          role: "assistant",
          content: "Streaming...",
        })}
      />,
    );
    // No time element should be present
    const timeEls = container.querySelectorAll("p.mt-1");
    expect(timeEls.length).toBe(0);
  });

  it("does not display timestamp when createdAt is null", () => {
    const { container } = render(
      <MessageBubble
        message={makeMessage({ createdAt: null, isStreaming: false })}
      />,
    );
    // Check no element matches the time regex pattern
    const allText = container.textContent ?? "";
    // Should only contain the message content, no time string
    expect(allText).toBe("Hello there");
  });

  // ── Tool calls ────────────────────────────────────────────────────

  it("does not show tool calls for user messages", () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: "user",
          toolCalls: [{ name: "search", status: "completed" }],
        })}
      />,
    );
    expect(screen.queryByTestId("tool-call-indicator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accordion")).not.toBeInTheDocument();
  });

  it("shows ToolCallIndicator for assistant tool calls without data", () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "Result",
          toolCalls: [{ name: "search", status: "running" }],
        })}
      />,
    );
    // Tool call has no args/result, so ToolCallIndicator is used
    expect(screen.getByTestId("tool-call-indicator")).toBeInTheDocument();
  });

  it("shows accordion for assistant tool calls with data", () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "Here are results",
          toolCalls: [
            {
              name: "search",
              status: "completed",
              args: { query: "test" },
              result: { data: "found" },
            },
          ],
        })}
      />,
    );
    expect(screen.getByTestId("accordion")).toBeInTheDocument();
    expect(screen.queryByTestId("tool-call-indicator")).not.toBeInTheDocument();
  });

  it("does not show tool call UI when toolCalls array is empty", () => {
    render(
      <MessageBubble
        message={makeMessage({
          role: "assistant",
          content: "No tools used",
          toolCalls: [],
        })}
      />,
    );
    expect(screen.queryByTestId("tool-call-indicator")).not.toBeInTheDocument();
    expect(screen.queryByTestId("accordion")).not.toBeInTheDocument();
  });
});
