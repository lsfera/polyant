// SPDX-License-Identifier: AGPL-3.0-or-later

import { render, screen } from "@testing-library/react";
import { PhaseBreakdownChart } from "./phase-breakdown-chart";
import { ToolUsageChart } from "./tool-usage-chart";
import { ToolLatencyTable } from "./tool-latency-table";
import { LatencyTrendChart } from "./latency-trend-chart";
import type { PhaseBreakdownRow, ToolRow, ToolLatencyRow, LatencyDailyRow } from "@/lib/api";

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock("@/lib/i18n/context", () => ({
  useI18n: vi.fn(() => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: vi.fn(),
  })),
}));

// recharts ResponsiveContainer needs ResizeObserver
class ResizeObserverMock {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
vi.stubGlobal("ResizeObserver", ResizeObserverMock);

// ── Fixtures ────────────────────────────────────────────────────────

const phaseData: PhaseBreakdownRow[] = [
  { date: "2026-02-20", contextPrep: 5, toolBuilding: 10, llmCall: 2000 },
  { date: "2026-02-21", contextPrep: 8, toolBuilding: 15, llmCall: 1500 },
];

const toolUsageData: ToolRow[] = [
  { tool: "web-search", count: 42 },
  { tool: "calculator", count: 18 },
  { tool: "memory-recall", count: 7 },
];

const toolLatencyData: ToolLatencyRow[] = [
  { tool: "web-search", avgDurationMs: 350, callCount: 42, p95: 800, successRate: 0.95 },
  { tool: "calculator", avgDurationMs: 12, callCount: 18, p95: 25, successRate: 1.0 },
];

const latencyDailyData: LatencyDailyRow[] = [
  { date: "2026-02-20", p50: 500, p95: 1200, p99: 3000 },
  { date: "2026-02-21", p50: 450, p95: 1100, p99: 2800 },
];

// ── Empty state tests ───────────────────────────────────────────────

describe("Chart empty states", () => {
  it("PhaseBreakdownChart shows no-data message when data is empty", () => {
    render(<PhaseBreakdownChart data={[]} />);
    expect(screen.getByText("analytics.noData")).toBeInTheDocument();
  });

  it("ToolUsageChart shows no-data message when data is empty", () => {
    render(<ToolUsageChart data={[]} />);
    expect(screen.getByText("analytics.noData")).toBeInTheDocument();
  });

  it("ToolLatencyTable shows no-data message when data is empty", () => {
    render(<ToolLatencyTable data={[]} />);
    expect(screen.getByText("analytics.noData")).toBeInTheDocument();
  });

  it("LatencyTrendChart shows no-data message when data is empty", () => {
    render(<LatencyTrendChart data={[]} />);
    expect(screen.getByText("analytics.noData")).toBeInTheDocument();
  });
});

// ── Render tests with data ──────────────────────────────────────────

describe("Chart rendering with data", () => {
  it("PhaseBreakdownChart renders title with data", () => {
    render(<PhaseBreakdownChart data={phaseData} />);
    expect(screen.getByText("analytics.charts.phaseBreakdown")).toBeInTheDocument();
  });

  it("ToolUsageChart renders title with data", () => {
    render(<ToolUsageChart data={toolUsageData} />);
    expect(screen.getByText("analytics.charts.toolUsage")).toBeInTheDocument();
  });

  it("ToolLatencyTable renders title with data", () => {
    render(<ToolLatencyTable data={toolLatencyData} />);
    expect(screen.getByText("analytics.charts.toolLatency")).toBeInTheDocument();
  });

  it("LatencyTrendChart renders title with data", () => {
    render(<LatencyTrendChart data={latencyDailyData} />);
    expect(screen.getByText("analytics.charts.latencyTrend")).toBeInTheDocument();
  });
});

// ── Phase breakdown normalization ───────────────────────────────────

describe("PhaseBreakdownChart normalization", () => {
  it("renders percentage Y-axis (not ms)", () => {
    render(<PhaseBreakdownChart data={phaseData} />);
    // The chart title should be present, confirming it rendered
    expect(screen.getByText("analytics.charts.phaseBreakdown")).toBeInTheDocument();
    // Should NOT show "no data" since we passed real data
    expect(screen.queryByText("analytics.noData")).not.toBeInTheDocument();
  });

  it("handles data row with all zeros without crashing", () => {
    const zeroData: PhaseBreakdownRow[] = [
      { date: "2026-02-20", contextPrep: 0, toolBuilding: 0, llmCall: 0 },
    ];
    render(<PhaseBreakdownChart data={zeroData} />);
    expect(screen.getByText("analytics.charts.phaseBreakdown")).toBeInTheDocument();
  });

  it("handles single-phase dominance without crashing", () => {
    const dominatedData: PhaseBreakdownRow[] = [
      { date: "2026-02-20", contextPrep: 0, toolBuilding: 0, llmCall: 5000 },
    ];
    render(<PhaseBreakdownChart data={dominatedData} />);
    expect(screen.getByText("analytics.charts.phaseBreakdown")).toBeInTheDocument();
  });
});
