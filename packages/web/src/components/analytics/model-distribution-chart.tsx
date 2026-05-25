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
import type { ModelRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ModelDistributionChartProps {
  data: ModelRow[];
}

export function ModelDistributionChart({ data }: ModelDistributionChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(
    () => data.map((r) => ({ name: r.model, value: r.calls, fill: "" })),
    [data],
  );

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    data.forEach((r, i) => {
      cfg[r.model] = {
        label: r.model,
        color: COLORS[i % COLORS.length],
      };
    });
    return cfg;
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.modelDistribution")}
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
              {chartData.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
