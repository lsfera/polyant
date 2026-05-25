// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Loader2, Check } from "lucide-react";
import type { ToolCallStatus } from "../_hooks/use-chat";

interface ToolCallIndicatorProps {
  toolCalls: ToolCallStatus[];
}

export function ToolCallIndicator({ toolCalls }: ToolCallIndicatorProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="mb-2 space-y-1">
      {toolCalls.map((tc, i) => (
        <div
          key={`${tc.name}-${i}`}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {tc.status === "running" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Check className="size-3 text-success" />
          )}
          <span>{tc.name}</span>
        </div>
      ))}
    </div>
  );
}
