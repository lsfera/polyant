// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n/context";
import { api, getUserErrorMessage } from "@/lib/api";

interface Props {
  /** When true, the current-password field is hidden — used in the forced
   *  change flow where the user is redirected after a reset. The engine
   *  still trusts the must_change_password flag, so omitting it is safe. */
  forced?: boolean;
  onSuccess?: () => void;
}

const MIN = 8;

export function ChangePasswordForm({ forced = false, onSuccess }: Props) {
  const { t } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < MIN) {
      toast.error(t("settings.password.tooShort"));
      return;
    }
    if (next !== confirm) {
      toast.error(t("settings.password.mismatch"));
      return;
    }
    setSubmitting(true);
    try {
      await api.me.changePassword({
        currentPassword: forced ? undefined : current,
        newPassword: next,
      });
      toast.success(t("settings.password.updated"));
      setCurrent("");
      setNext("");
      setConfirm("");
      onSuccess?.();
    } catch (err) {
      toast.error(getUserErrorMessage(err, t("settings.password.failed")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!forced && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cp-current">{t("settings.password.current")}</Label>
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-new">{t("settings.password.new")}</Label>
        <Input
          id="cp-new"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          // Tell password managers (1Password / Bitwarden / LastPass) NOT to
          // autofill the OLD saved password into the NEW password field — they
          // ignore autocomplete="new-password" on this kind of forced-rotation
          // flow and would otherwise pre-fill the field the user is trying to
          // replace. Safe to apply here because this form is exclusively for
          // entering NEW credentials.
          data-1p-ignore
          data-lpignore="true"
          required
          minLength={MIN}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cp-confirm">{t("settings.password.confirm")}</Label>
        <Input
          id="cp-confirm"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          data-1p-ignore
          data-lpignore="true"
          required
          minLength={MIN}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>
      <div>
        <Button type="submit" disabled={submitting}>
          {t("settings.password.submit")}
        </Button>
      </div>
    </form>
  );
}
