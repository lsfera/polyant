// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, MessageSquareCode, KeyRound, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { MessageBubble } from "./message-bubble";
import { ChatInput } from "./chat-input";
import { InstanceSelector } from "./instance-selector";
import { ChatHistoryDialog } from "./chat-sidebar";
import { useI18n } from "@/lib/i18n/context";
import type { ChatMessage } from "../_hooks/use-chat";
import type { ConversationListItem } from "@/lib/api";

interface ChatAreaProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  instanceSlug: string;
  error: string | null;
  conversations: ConversationListItem[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  authToken: string;
  onAuthTokenChange: (token: string) => void;
  onSend: (text: string) => void;
  onStop: () => void;
  onInstanceChange: (slug: string) => void;
  onNewChat: () => void;
  onSelectConversation: (conversationId: string) => void;
}

export function ChatArea({
  messages,
  isStreaming,
  instanceSlug,
  error,
  conversations,
  conversationsLoading,
  activeConversationId,
  authToken,
  onAuthTokenChange,
  onSend,
  onStop,
  onInstanceChange,
  onNewChat,
  onSelectConversation,
}: ChatAreaProps) {
  const { t } = useI18n();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState(false);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: isStreaming ? "smooth" : "instant",
    });
  }, [messages, isStreaming]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header with instance selector + actions */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <InstanceSelector
          value={instanceSlug}
          onChange={onInstanceChange}
          disabled={isStreaming}
        />

        {/* Auth token inline input */}
        {showKeyInput && (
          <div className="relative flex-1 max-w-xs">
            <Input
              type={showKeyValue ? "text" : "password"}
              value={authToken}
              onChange={(e) => onAuthTokenChange(e.target.value)}
              placeholder={t("playground.authKeyPlaceholder")}
              className="h-8 pr-8 text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKeyValue(!showKeyValue)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showKeyValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={authToken ? "default" : "ghost"}
                size="icon"
                className="size-8"
                onClick={() => setShowKeyInput(!showKeyInput)}
              >
                <KeyRound className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {t("playground.authKeyToggle")}
            </TooltipContent>
          </Tooltip>
          <ChatHistoryDialog
            conversations={conversations}
            loading={conversationsLoading}
            activeConversationId={activeConversationId}
            onSelectConversation={onSelectConversation}
          />
          <Button size="sm" onClick={onNewChat}>
            <Plus className="mr-2 size-4" />
            {t("playground.newChat")}
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[400px] flex-col items-center justify-center text-center">
            <MessageSquareCode className="size-12 text-muted-foreground/30" />
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              {t("playground.title")}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {t("playground.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4 p-4">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Input */}
      <ChatInput
        onSend={onSend}
        onStop={onStop}
        isStreaming={isStreaming}
        disabled={!instanceSlug}
      />
    </div>
  );
}
