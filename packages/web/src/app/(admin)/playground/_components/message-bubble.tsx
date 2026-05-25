// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Wrench, Terminal } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { MarkdownRenderer } from "./markdown-renderer";
import { ToolCallIndicator } from "./tool-call-indicator";
import type { ChatMessage, ToolCallStatus } from "../_hooks/use-chat";

function hasToolCallData(toolCalls: ToolCallStatus[]): boolean {
  return toolCalls.some((tc) => tc.args !== undefined || tc.result !== undefined);
}

function ToolCallsAccordion({ toolCalls }: { toolCalls: ToolCallStatus[] }) {
  return (
    <Accordion type="single" collapsible className="mt-1">
      {toolCalls.map((tc, i) => (
        <AccordionItem key={i} value={`tool-${i}`} className="border-none">
          <AccordionTrigger className="py-1 text-xs text-muted-foreground hover:no-underline">
            <span className="flex items-center gap-1">
              <Wrench className="h-3 w-3" />
              {tc.name}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <pre className="max-w-full overflow-x-auto rounded-sm bg-secondary p-2 text-xs">
              {JSON.stringify({ args: tc.args, result: tc.result }, null, 2)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  // parseUTC not needed here — playground timestamps are generated client-side with toISOString() (already has Z)
  return new Date(dateStr).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  // System message → centered amber pill
  if (message.role === "system") {
    return (
      <div className="flex justify-center">
        <div className="max-w-[85%] rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30">
          <div className="flex items-start gap-2">
            <Terminal className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="min-w-0">
              <p className="whitespace-pre-wrap text-sm text-amber-800 dark:text-amber-200">
                {message.content}
              </p>
              {message.createdAt && (
                <p className="mt-1 text-xs text-amber-600/60 dark:text-amber-400/60">
                  {formatTime(message.createdAt)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] min-w-0 overflow-hidden break-words rounded-2xl px-4 py-3 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {/* Tool calls shown above assistant text */}
        {!isUser && message.toolCalls.length > 0 && (
          hasToolCallData(message.toolCalls)
            ? <ToolCallsAccordion toolCalls={message.toolCalls} />
            : <ToolCallIndicator toolCalls={message.toolCalls} />
        )}

        {/* Message content */}
        {isUser ? (
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        ) : message.content ? (
          <div className="text-sm">
            <MarkdownRenderer content={message.content} />
          </div>
        ) : message.isStreaming ? (
          <div className="flex items-center gap-1 py-1">
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:0ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
            <span className="size-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
          </div>
        ) : null}

        {/* Timestamp */}
        {message.createdAt && !message.isStreaming && (
          <p
            className={`mt-1 text-xs ${
              isUser ? "text-primary-foreground/60" : "text-muted-foreground"
            }`}
          >
            {formatTime(message.createdAt)}
          </p>
        )}
      </div>
    </div>
  );
}
