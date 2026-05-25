// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Layout for full-screen, blocking pages (forced password change, etc.).
 * Intentionally does NOT include the admin sidebar/header — the user is
 * locked into this view until the action is completed.
 */
export default function ForceLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
