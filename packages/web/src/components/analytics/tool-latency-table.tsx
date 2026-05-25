// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ToolLatencyRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { CHART_PALETTE as toolColors } from "./chart-palette";

interface ToolLatencyTableProps {
  data: ToolLatencyRow[];
}

export function ToolLatencyTable({ data }: ToolLatencyTableProps) {
  const { t } = useI18n();

  // Build a dynamic config with one entry per tool for proper tooltip labels
  const chartConfig = data.reduce<Record<string, { label: string; color: string }>>((acc, row, i) => {
    acc[row.tool] = {
      label: row.tool,
      color: toolColors[i % toolColors.length],
    };
    return acc;
  }, {}) satisfies ChartConfig;

  // Add the avgDurationMs key so the tooltip can resolve the series
  const fullConfig: ChartConfig = {
    avgDurationMs: { label: t("analytics.charts.toolLatency"), color: "#000000" },
    ...chartConfig,
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.toolLatency")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
        <ChartContainer config={fullConfig} className="h-[250px] w-full">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis
              type="number"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(v) => `${v}ms`}
            />
            <YAxis
              type="category"
              dataKey="tool"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={120}
              tickFormatter={(v) =>
                v.length > 16 ? v.slice(0, 14) + "..." : v
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, _name, item) => {
                    const row = item.payload as ToolLatencyRow;
                    const fillColor = (item.payload as Record<string, unknown>).fill as string | undefined;
                    return (
                      <div className="flex items-start gap-2">
                        <div
                          className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-[2px]"
                          style={{ backgroundColor: fillColor ?? item.color }}
                        />
                        <div className="grid gap-0.5">
                          <span className="font-medium">{row.tool}</span>
                          <span>avg: {Math.round(Number(value))}ms</span>
                          <span>p95: {row.p95}ms</span>
                          <span>calls: {row.callCount}</span>
                          <span>success: {Math.round(row.successRate * 100)}%</span>
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="avgDurationMs" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={toolColors[i % toolColors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
