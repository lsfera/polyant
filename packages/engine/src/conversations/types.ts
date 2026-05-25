// SPDX-License-Identifier: AGPL-3.0-or-later

export interface ConversationRecord {
  id: string;
  conversationId: string;
  summary: string | null;
  instanceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
