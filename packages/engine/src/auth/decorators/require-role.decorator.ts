// SPDX-License-Identifier: AGPL-3.0-or-later

import { SetMetadata } from "@nestjs/common";
import type { UserRole } from "../users.schema.js";

export const REQUIRED_ROLES_KEY = "requiredRoles";

/**
 * Restrict a route to one or more roles. Used together with the global
 * RoleGuard. The AuthGuard runs first and populates `request.user`; the
 * RoleGuard then checks `user.role`. Routes without this decorator are
 * accessible to any authenticated user (or to anonymous if also @Public()).
 */
export const RequireRole = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
