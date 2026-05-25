// SPDX-License-Identifier: AGPL-3.0-or-later

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh items-center justify-center">
      {children}
    </div>
  );
}
