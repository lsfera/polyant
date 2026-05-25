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
import type { ChannelRow } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";

const CHANNEL_COLORS: Record<string, string> = {
  web: "var(--chart-1)",
  telegram: "#0088cc",
  slack: "#4A154B",
  whatsapp: "#25D366",
};

interface ChannelDistributionChartProps {
  data: ChannelRow[];
}

export function ChannelDistributionChart({ data }: ChannelDistributionChartProps) {
  const { t } = useI18n();

  const chartData = useMemo(
    () => data.map((r) => ({ name: r.channel, value: r.conversations })),
    [data],
  );

  const chartConfig = useMemo(() => {
    const cfg: ChartConfig = {};
    data.forEach((r) => {
      cfg[r.channel] = {
        label: r.channel.charAt(0).toUpperCase() + r.channel.slice(1),
        color: CHANNEL_COLORS[r.channel] ?? "var(--chart-3)",
      };
    });
    return cfg;
  }, [data]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          {t("analytics.charts.channelDistribution")}
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
                  fill={CHANNEL_COLORS[entry.name] ?? "var(--chart-3)"}
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
