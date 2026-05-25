// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { PhaseBreakdownRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { PHASE_COLORS as phaseColors } from "./chart-palette";

interface PhaseBreakdownChartProps {
  data: PhaseBreakdownRow[];
}

const PHASE_KEYS = ["contextPrep", "toolBuilding", "llmCall"] as const;

export function PhaseBreakdownChart({ data }: PhaseBreakdownChartProps) {
  const { t } = useI18n();

  // Normalize to percentages so all phases are visible (llmCall dominates absolute values)
  const normalizedData = useMemo(
    () =>
      data.map((row) => {
        const total = PHASE_KEYS.reduce((sum, k) => sum + (row[k] ?? 0), 0);
        if (total === 0) {
          return { date: row.date, contextPrep: 0, toolBuilding: 0, llmCall: 0, total_abs: 0 };
        }
        return {
          date: row.date,
          ...Object.fromEntries(PHASE_KEYS.map((k) => [k, ((row[k] ?? 0) / total) * 100])),
          // Keep absolute values for the tooltip
          ...Object.fromEntries(PHASE_KEYS.map((k) => [`${k}_abs`, Math.round(row[k] ?? 0)])),
          total_abs: Math.round(total),
        };
      }),
    [data],
  );

  const chartConfig = {
    contextPrep: { label: t("analytics.phases.contextPrep"), color: phaseColors.contextPrep },
    toolBuilding: { label: t("analytics.phases.toolBuilding"), color: phaseColors.toolBuilding },
    llmCall: { label: t("analytics.phases.llmCall"), color: phaseColors.llmCall },
  } satisfies ChartConfig;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.phaseBreakdown")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart data={normalizedData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getDate()}/${d.getMonth() + 1}`;
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 100]}
              tickFormatter={(v) => `${Math.round(v)}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(v, payload) => {
                    const d = new Date(v);
                    const total = payload?.[0]?.payload?.total_abs;
                    return `${d.toLocaleDateString()}${total != null ? ` — ${total}ms total` : ""}`;
                  }}
                  formatter={(value, name, item) => {
                    const absKey = `${String(name)}_abs`;
                    const absVal = item.payload[absKey] as number;
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="flex-1">{chartConfig[name as keyof typeof chartConfig]?.label ?? name}</span>
                        <span className="font-mono tabular-nums">{Math.round(Number(value))}%</span>
                        <span className="font-mono tabular-nums text-muted-foreground">{absVal}ms</span>
                      </div>
                    );
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="contextPrep" stackId="phases" fill={phaseColors.contextPrep} />
            <Bar dataKey="toolBuilding" stackId="phases" fill={phaseColors.toolBuilding} />
            <Bar dataKey="llmCall" stackId="phases" fill={phaseColors.llmCall} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
