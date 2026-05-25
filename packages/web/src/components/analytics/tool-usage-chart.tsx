// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { ToolRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { CHART_PALETTE as toolColors } from "./chart-palette";

interface ToolUsageChartProps {
  data: ToolRow[];
}

export function ToolUsageChart({ data }: ToolUsageChartProps) {
  const { t } = useI18n();

  const chartConfig = useMemo(() => {
    const cfg: Record<string, { label: string; color: string }> = {
      count: { label: t("analytics.charts.toolUsage"), color: "#000000" },
    };
    data.slice(0, 10).forEach((row, i) => {
      cfg[row.tool] = {
        label: row.tool,
        color: toolColors[i % toolColors.length],
      };
    });
    return cfg satisfies ChartConfig;
  }, [data, t]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.toolUsage")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
        <ChartContainer config={chartConfig} className="h-[250px] w-full">
          <BarChart
            data={data.slice(0, 10)}
            layout="vertical"
            margin={{ top: 5, right: 10, left: 10, bottom: 0 }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} />
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
            <ChartTooltip content={<ChartTooltipContent nameKey="tool" />} />
            <Bar dataKey="count" radius={[0, 4, 4, 0]}>
              {data.slice(0, 10).map((_, i) => (
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
