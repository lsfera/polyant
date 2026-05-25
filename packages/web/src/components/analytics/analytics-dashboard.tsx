// SPDX-License-Identifier: AGPL-3.0-or-later

"use client";

import { useCallback, useEffect, useState } from "react";
import { subDays, format } from "date-fns";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import type { AnalyticsResponse } from "@/lib/api";
import { useI18n } from "@/lib/i18n/context";
import { DateRangePicker, type DateRange } from "./date-range-picker";
import { KpiCards } from "./kpi-cards";
import { CostTrendChart } from "./cost-trend-chart";
import { ConversationTrendChart } from "./conversation-trend-chart";
import { HourlyHeatmap } from "./hourly-heatmap";
import { ModelDistributionChart } from "./model-distribution-chart";
import { TierDistributionChart } from "./tier-distribution-chart";
import { ToolUsageChart } from "./tool-usage-chart";
import { ChannelDistributionChart } from "./channel-distribution-chart";
import { InstanceComparisonTable } from "./instance-comparison-table";
import { LatencyTrendChart } from "./latency-trend-chart";
import { ToolLatencyTable } from "./tool-latency-table";

interface AnalyticsDashboardProps {
  fetchData: (from: string, to: string) => Promise<AnalyticsResponse>;
  showInstanceComparison?: boolean;
}

const toISO = (d: Date) => format(d, "yyyy-MM-dd");

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-[340px] rounded-lg" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-[290px] rounded-lg" />
        <Skeleton className="h-[290px] rounded-lg" />
      </div>
    </div>
  );
}

export function AnalyticsDashboard({
  fetchData,
  showInstanceComparison = false,
}: AnalyticsDashboardProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [range, setRange] = useState<DateRange>(() => {
    const now = new Date();
    return { from: toISO(subDays(now, 30)), to: toISO(now) };
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchData(range.from, range.to);
      setData(result);
    } catch {
      toast.error(t("analytics.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [fetchData, range, t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div />
        <DateRangePicker value={range} onChange={setRange} />
      </div>

      {loading || !data ? (
        <DashboardSkeleton />
      ) : (
        <>
          <KpiCards data={data.overview} />

          <CostTrendChart data={data.dailyTrend} />

          <div className="grid gap-4 lg:grid-cols-2">
            <ConversationTrendChart data={data.dailyTrend} />
            <HourlyHeatmap data={data.hourlyDistribution} />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <ChannelDistributionChart data={data.channelDistribution} />
            <ModelDistributionChart data={data.modelDistribution} />
            <TierDistributionChart data={data.tierDistribution} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ToolUsageChart data={data.toolUsage} />
            <ToolLatencyTable data={data.latency?.slowestTools ?? []} />
          </div>

          <LatencyTrendChart data={data.latency?.dailyLatency ?? []} />

          {showInstanceComparison && (
            <InstanceComparisonTable data={data.instanceComparison ?? []} />
          )}
        </>
      )}
    </div>
  );
}
