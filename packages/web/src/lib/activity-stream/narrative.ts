// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Activity Stream — narrative rendering.
 *
 * Turn a `FeedEvent` into a tokenized sentence ("CustomerCare sta usando
 * hubspotNote…", "Bob wrote to CustomerCare via whatsapp", …). The
 * result is an array of typed tokens — the render layer assigns a visual
 * treatment to each token type so the important pieces (agent name, tool
 * name, duration) stand out at a glance.
 *
 * Pure function. Templates are i18n strings passed in via `NarrativeLabels`;
 * placeholder substitution happens here and emits one token per param.
 */

import { eventKind, type EventKind, type FeedEvent } from "./types";

export type NarrativeTokenType =
  | "text"
  | "subject"
  | "tool"
  | "channel"
  | "duration"
  | "sender"
  | "gate"
  | "phase"
  | "count";

export interface NarrativeToken {
  type: NarrativeTokenType;
  value: string;
}

/**
 * Templates are plain strings with `{key}` placeholders — the same shape
 * the i18n layer already produces. The narrative module knows the type of
 * each named placeholder, so a single `tokenize()` pass per template
 * yields the typed token list.
 */
export interface NarrativeLabels {
  subjects: {
    /** Neutral subject for webhook rows. Receives the source. */
    webhook: string;
    /** Neutral subject for cron rows. Receives the task name. */
    cron: string;
    /** Standalone label for conversation lifecycle events. */
    conversation: string;
    /** Absolute fallback when nothing else makes sense. */
    system: string;
  };
  templates: {
    tool: {
      running: string;
      success: string;
      error: string;
      done: string;
    };
    thinking: string;
    reply: {
      withChannel: string;
      noChannel: string;
    };
    inbound: {
      withSender: string;
      anonymous: string;
      scheduled: string;
    };
    outbound: {
      success: string;
      error: string;
    };
    webhook: string;
    cron: string;
    memory: string;
    conversation: {
      createdWithChannel: string;
      createdNoChannel: string;
      archived: string;
    };
    handoff: {
      running: string;
      success: string;
      error: string;
      done: string;
    };
  };
}

export interface Narrative {
  tokens: NarrativeToken[];
  /** True while the originating step is still in flight (`:start` without
   *  a paired `:end` yet). The renderer can show a spinner. */
  pending: boolean;
}

/** Compact, human-friendly duration string. */
export function formatDuration(ms: number | undefined): string | null {
  if (ms == null || ms < 0) return null;
  if (ms < 1_000) return `${ms} ms`;
  return `${(ms / 1_000).toFixed(1)} s`;
}

/**
 * Substitute `{key}` placeholders in `template` with the supplied named
 * tokens, producing one `text` token per literal chunk and one typed
 * token per substitution. Unknown placeholders pass through unchanged
 * (defensive: a stale i18n key won't blow up the render).
 */
function tokenize(
  template: string,
  params: Record<string, NarrativeToken>,
): NarrativeToken[] {
  const out: NarrativeToken[] = [];
  const re = /\{(\w+)\}/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(template)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: "text", value: template.slice(lastIndex, m.index) });
    }
    const key = m[1];
    const tok = params[key];
    if (tok) {
      out.push(tok);
    } else {
      out.push({ type: "text", value: m[0] });
    }
    lastIndex = re.lastIndex;
  }
  if (lastIndex < template.length) {
    out.push({ type: "text", value: template.slice(lastIndex) });
  }
  return out;
}

function isPending(ev: FeedEvent): boolean {
  return ev.id.endsWith(":start");
}

function subjectToken(ev: FeedEvent, labels: NarrativeLabels): NarrativeToken {
  return {
    type: "subject",
    value: ev.instance?.name ?? labels.subjects.system,
  };
}

export function narrate(ev: FeedEvent, labels: NarrativeLabels): Narrative {
  const kind: EventKind = eventKind(ev);
  const t = labels.templates;
  const pending = isPending(ev);

  switch (kind) {
    case "tool": {
      const instance = subjectToken(ev, labels);
      const tool: NarrativeToken = {
        type: "tool",
        value: ev.tool?.name ?? "tool",
      };
      if (pending) {
        return { tokens: tokenize(t.tool.running, { instance, tool }), pending: true };
      }
      const formatted = formatDuration(ev.durationMs);
      if (formatted == null) {
        return { tokens: tokenize(t.tool.done, { instance, tool }), pending: false };
      }
      const duration: NarrativeToken = { type: "duration", value: formatted };
      const template = ev.status === "error" ? t.tool.error : t.tool.success;
      return {
        tokens: tokenize(template, { instance, tool, duration }),
        pending: false,
      };
    }

    case "thinking": {
      return {
        tokens: tokenize(t.thinking, { instance: subjectToken(ev, labels) }),
        pending: false,
      };
    }

    case "reply": {
      const instance = subjectToken(ev, labels);
      const channelType = ev.conversation?.channel;
      if (channelType) {
        return {
          tokens: tokenize(t.reply.withChannel, {
            instance,
            channel: { type: "channel", value: channelType },
          }),
          pending: false,
        };
      }
      return { tokens: tokenize(t.reply.noChannel, { instance }), pending: false };
    }

    case "inbound": {
      const instance = subjectToken(ev, labels);
      const channel: NarrativeToken = {
        type: "channel",
        value: ev.channel?.type ?? "—",
      };
      // Scheduled-task inbounds get a dedicated narrative: the regular
      // "sender wrote to X via Y" reads awkwardly when the sender is the
      // internal scheduler. Falls back to the standard templates if taskName
      // is absent (older events before the field was emitted).
      if (ev.channel?.type === "scheduled" && ev.channel?.taskName) {
        return {
          tokens: tokenize(t.inbound.scheduled, {
            instance,
            taskName: { type: "tool", value: ev.channel.taskName },
          }),
          pending: false,
        };
      }
      const senderRaw = ev.channel?.sender;
      if (senderRaw) {
        return {
          tokens: tokenize(t.inbound.withSender, {
            instance,
            sender: { type: "sender", value: senderRaw },
            channel,
          }),
          pending: false,
        };
      }
      return {
        tokens: tokenize(t.inbound.anonymous, { instance, channel }),
        pending: false,
      };
    }

    case "outbound": {
      const instance = subjectToken(ev, labels);
      const channel: NarrativeToken = {
        type: "channel",
        value: ev.channel?.type ?? "—",
      };
      const template = ev.status === "error" ? t.outbound.error : t.outbound.success;
      return { tokens: tokenize(template, { instance, channel }), pending: false };
    }

    case "webhook": {
      const sourceName = ev.webhook?.source ?? "?";
      const definitionName = ev.webhook?.definition ?? "—";
      const subjectValue = labels.subjects.webhook.replaceAll("{source}", sourceName);
      return {
        tokens: tokenize(t.webhook, {
          source: { type: "subject", value: subjectValue },
          definition: { type: "tool", value: definitionName },
        }),
        pending: false,
      };
    }

    case "cron": {
      const name = ev.cron?.name ?? "—";
      const subjectValue = labels.subjects.cron.replaceAll("{name}", name);
      return {
        tokens: tokenize(t.cron, {
          name: { type: "subject", value: subjectValue },
          schedule: { type: "channel", value: ev.cron?.schedule ?? "—" },
        }),
        pending: false,
      };
    }

    case "memory": {
      const instance = subjectToken(ev, labels);
      const count: NarrativeToken = {
        type: "count",
        value: String(ev.memory?.count ?? 0),
      };
      return { tokens: tokenize(t.memory, { instance, count }), pending: false };
    }

    case "conversation": {
      const lifecycle = ev.conversation?.lifecycle;
      if (lifecycle === "archived") {
        return { tokens: tokenize(t.conversation.archived, {}), pending: false };
      }
      const channelType = ev.conversation?.channel;
      if (channelType) {
        return {
          tokens: tokenize(t.conversation.createdWithChannel, {
            channel: { type: "channel", value: channelType },
          }),
          pending: false,
        };
      }
      return { tokens: tokenize(t.conversation.createdNoChannel, {}), pending: false };
    }

    case "agent-handoff": {
      const from: NarrativeToken = {
        type: "subject",
        value:
          ev.handoff?.fromInstance.name ?? ev.instance?.name ?? labels.subjects.system,
      };
      const to: NarrativeToken = {
        type: "subject",
        value: ev.handoff?.toInstance.name ?? "?",
      };
      if (pending) {
        return { tokens: tokenize(t.handoff.running, { from, to }), pending: true };
      }
      const formatted = formatDuration(ev.durationMs);
      if (formatted == null) {
        return { tokens: tokenize(t.handoff.done, { from, to }), pending: false };
      }
      const duration: NarrativeToken = { type: "duration", value: formatted };
      const template = ev.status === "error" ? t.handoff.error : t.handoff.success;
      return {
        tokens: tokenize(template, { from, to, duration }),
        pending: false,
      };
    }
  }
}

/** Convenience: flatten the tokens back to a plain string (tests, tooltips). */
export function narrativeText(n: Narrative): string {
  return n.tokens.map((tok) => tok.value).join("");
}
