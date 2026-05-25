// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useState } from "react";
import { format, subDays } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useI18n } from "@/lib/i18n/context";

export interface DateRange {
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [calFrom, setCalFrom] = useState<Date | undefined>();
  const [calTo, setCalTo] = useState<Date | undefined>();

  const presets = [
    { label: t("analytics.dateRange.7d"), days: 7 },
    { label: t("analytics.dateRange.30d"), days: 30 },
    { label: t("analytics.dateRange.90d"), days: 90 },
  ];

  const activeDays = Math.round(
    (new Date(value.to).getTime() - new Date(value.from).getTime()) /
      (1000 * 60 * 60 * 24),
  );

  const applyPreset = (days: number) => {
    const now = new Date();
    onChange({ from: toISO(subDays(now, days)), to: toISO(now) });
  };

  const applyCustom = () => {
    if (calFrom && calTo) {
      onChange({ from: toISO(calFrom), to: toISO(calTo) });
      setOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.days}
          variant={activeDays === p.days ? "default" : "outline"}
          size="sm"
          onClick={() => applyPreset(p.days)}
        >
          {p.label}
        </Button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <CalendarIcon className="h-3.5 w-3.5" />
            {t("analytics.dateRange.custom")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-4" align="end">
          <div className="flex gap-4">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("analytics.dateRange.from")}
              </p>
              <Calendar
                mode="single"
                selected={calFrom}
                onSelect={setCalFrom}
                disabled={(date) => date > new Date()}
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("analytics.dateRange.to")}
              </p>
              <Calendar
                mode="single"
                selected={calTo}
                onSelect={setCalTo}
                disabled={(date) =>
                  date > new Date() || (calFrom ? date < calFrom : false)
                }
              />
            </div>
          </div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={applyCustom} disabled={!calFrom || !calTo}>
              {t("analytics.dateRange.apply")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
