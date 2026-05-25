// SPDX-License-Identifier: AGPL-3.0-or-later

import { config } from "../config.js";
import { generateToken } from "../crypto/index.js";
import { hashPassword } from "./password.util.js";
import { countUsers, insertUser } from "./users.store.js";

/**
 * Idempotent: on first boot (users table empty) creates a `superadmin` account
 * so the system is "ready for first access" without requiring Google OAuth.
 *
 * The password is taken from INITIAL_ADMIN_PASSWORD if set, otherwise
 * generated and printed in plaintext to the logs ONE time, with a warning
 * to change it immediately. `must_change_password` is true so the user is
 * forced to rotate it on first login.
 *
 * Subsequent boots are no-ops — never overwrites existing users.
 */
export async function seedInitialAdmin(): Promise<void> {
  const existing = await countUsers();
  if (existing > 0) {
    console.log(`[users/seed] Skipped — ${existing} user(s) already exist`);
    return;
  }

  const email = config.initialAdmin.email ?? "administrator@local";
  const fromEnv = !!config.initialAdmin.password;
  const password = config.initialAdmin.password ?? generateToken(9);

  const passwordHash = await hashPassword(password);

  await insertUser({
    email,
    name: "administrator",
    passwordHash,
    role: "superadmin",
    mustChangePassword: true,
  });

  if (!fromEnv) {
    const banner = [
      "",
      "==============================================================",
      "  INITIAL ADMIN CREATED",
      "==============================================================",
      `  email:    ${email}`,
      `  password: ${password}`,
      "",
      "  This password is shown ONLY at first boot. Change it from",
      "  /settings or remove the user from /users after creating",
      "  another superadmin.",
      "==============================================================",
      "",
    ].join("\n");
    console.warn(banner);
  } else {
    console.log(
      `[users/seed] Seeded admin "${email}" with provided password (INITIAL_ADMIN_PASSWORD)`,
    );
  }
}
