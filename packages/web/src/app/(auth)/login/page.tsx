// SPDX-License-Identifier: AGPL-3.0-or-later

import { Suspense } from "react";
import { isGoogleAuthEnabled } from "@/lib/auth.config";
import { LoginFormClient } from "./login-form-client";

/**
 * Server entry: reads the (server-side) `isGoogleAuthEnabled` flag from
 * `auth.config` and passes it down so the Google sign-in button is only
 * rendered when the provider is actually loaded. Without the gate, clicking
 * the button when `GOOGLE_CLIENT_ID`/`SECRET` are unset would crash
 * Auth.js. Credentials login still works in either case.
 */
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFormClient googleEnabled={isGoogleAuthEnabled} />
    </Suspense>
  );
}
