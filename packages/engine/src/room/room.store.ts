// SPDX-License-Identifier: AGPL-3.0-or-later

import { eq } from "drizzle-orm";
import { db } from "../database/client.js";
import { instanceRoom } from "./room.schema.js";
import { resolveInstanceId } from "../instances/resolve-instance-id.js";

export interface RoomConfig {
  id: string;
  instanceId: string;
  enabled: boolean;
  prompt: string;
  outboundChannel: string | null;
  outboundTarget: string | null;
  evalIntervalMinutes: number;
  conversationId: string | null;
}

export async function getRoomBySlug(slug: string): Promise<RoomConfig | null> {
  const instanceId = await resolveInstanceId(slug);
  if (!instanceId) return null;
  return getRoomByInstanceId(instanceId);
}

export async function getRoomByInstanceId(instanceId: string): Promise<RoomConfig | null> {
  const rows = await db
    .select()
    .from(instanceRoom)
    .where(eq(instanceRoom.instanceId, instanceId))
    .limit(1);

  if (!rows[0]) return null;
  return rows[0] as RoomConfig;
}

export async function upsertRoom(
  instanceId: string,
  data: {
    enabled?: boolean;
    prompt?: string;
    outboundChannel?: string | null;
    outboundTarget?: string | null;
    evalIntervalMinutes?: number;
  },
): Promise<void> {
  await db
    .insert(instanceRoom)
    .values({
      instanceId,
      enabled: data.enabled ?? false,
      prompt: data.prompt ?? "",
      outboundChannel: data.outboundChannel ?? null,
      outboundTarget: data.outboundTarget ?? null,
      evalIntervalMinutes: data.evalIntervalMinutes ?? 5,
    })
    .onConflictDoUpdate({
      target: [instanceRoom.instanceId],
      set: {
        ...data,
        updatedAt: new Date(),
      },
    });
}

export async function deleteRoom(instanceId: string): Promise<void> {
  await db.delete(instanceRoom).where(eq(instanceRoom.instanceId, instanceId));
}

export async function setRoomConversationId(instanceId: string, conversationId: string): Promise<void> {
  await db
    .update(instanceRoom)
    .set({ conversationId, updatedAt: new Date() })
    .where(eq(instanceRoom.instanceId, instanceId));
}

export async function listEnabledRooms(): Promise<RoomConfig[]> {
  const rows = await db
    .select()
    .from(instanceRoom)
    .where(eq(instanceRoom.enabled, true));
  return rows as RoomConfig[];
}
