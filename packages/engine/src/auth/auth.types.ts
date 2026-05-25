// SPDX-License-Identifier: AGPL-3.0-or-later
import type { UserRole } from "./users.schema.js";

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name?: string;
  role: UserRole;
  mustChangePassword: boolean;
}
