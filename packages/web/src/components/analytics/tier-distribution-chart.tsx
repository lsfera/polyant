// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useMemo } from "react";
import { Pie, PieChart, Cell } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { TierRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

const TIER_COLORS: Record<string, string> = {
  fast: "var(--chart-4)",
  standard: "var(--chart-1)",
  heavy: "var(--chart-2)",
};

interface TierDistributionChartProps {
  data: TierRow[];
}

export function TierDistributionChart({ data }: TierDistributionChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(
    () => data.map((r) => ({ name: r.tier, value: r.calls })),
    [data],
  );

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    data.forEach((r) => {
      cfg[r.tier] = {
        label: r.tier.charAt(0).toUpperCase() + r.tier.slice(1),
        color: TIER_COLORS[r.tier] ?? "var(--chart-3)",
      };
    });
    return cfg;
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.tierDistribution")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
            {t("analytics.noData")}
          </div>
        ) : (
        <ChartContainer config={chartConfig} className="mx-auto h-[250px] w-full">
          <PieChart>
            <ChartTooltip content={<ChartTooltipContent nameKey="name" />} />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={TIER_COLORS[entry.name] ?? "var(--chart-3)"}
                />
              ))}
            </Pie>
            <ChartLegend content={<ChartLegendContent nameKey="name" />} />
          </PieChart>
        </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
