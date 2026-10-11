"use client";

import Skeleton from "@/components/common/Skeleton";
import { useTheme } from "@/context/ThemeContext";
import { formatNumber, formatXOF } from "@/lib/format";
import type { ApexOptions } from "apexcharts";
import dynamic from "next/dynamic";

const ReactApexChart = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => <Skeleton className="h-full min-h-48 w-full" />,
});

/** Palette BIRCOVET (copiée du thème @theme : brand, tertiary, secondary, warning, error…). */
export const CHART_COLORS = ["#04a154", "#019cc8", "#6ab391", "#f79009", "#f04438", "#7a5af8", "#ee46bc", "#98a2b3"];

const fmtShort = (v: number) => (Math.abs(v) >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)} M` : Math.abs(v) >= 1000 ? `${Math.round(v / 1000)} k` : `${Math.round(v)}`);

function useBase(currency?: boolean): ApexOptions {
  const { theme } = useTheme();
  return {
    chart: { fontFamily: "Outfit, sans-serif", toolbar: { show: false }, zoom: { enabled: false }, background: "transparent" },
    theme: { mode: theme },
    colors: CHART_COLORS,
    dataLabels: { enabled: false },
    grid: { borderColor: theme === "dark" ? "#1d2939" : "#f2f4f7", strokeDashArray: 3, yaxis: { lines: { show: true } } },
    legend: { position: "top", horizontalAlign: "left", fontSize: "12px", markers: { size: 5 } },
    tooltip: { y: { formatter: (v: number) => (currency ? formatXOF(v) : formatNumber(v)) } },
    yaxis: { labels: { formatter: (v: number) => (currency ? fmtShort(v) : formatNumber(Math.round(v))) } },
  };
}

interface SeriesChartProps {
  labels: string[];
  series: { name: string; data: number[] }[];
  height?: number;
  currency?: boolean;
}

export function AreaChart({ labels, series, height = 280, currency }: SeriesChartProps) {
  const base = useBase(currency);
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "area" },
    stroke: { curve: "smooth", width: 2 },
    fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0 } },
    xaxis: { categories: labels, axisBorder: { show: false }, axisTicks: { show: false } },
  };
  return <ReactApexChart options={options} series={series} type="area" height={height} />;
}

export function BarChart({ labels, series, height = 280, currency, stacked, horizontal }: SeriesChartProps & { stacked?: boolean; horizontal?: boolean }) {
  const base = useBase(currency);
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "bar", stacked },
    plotOptions: { bar: { horizontal, columnWidth: "45%", borderRadius: 4, borderRadiusApplication: "end" } },
    xaxis: {
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: horizontal ? { formatter: (v: string) => (currency ? fmtShort(Number(v)) : v) } : undefined,
    },
    yaxis: horizontal ? { labels: { maxWidth: 180 } } : base.yaxis,
  };
  return <ReactApexChart options={options} series={series} type="bar" height={height} />;
}

export function DonutChart({ labels, values, height = 280, currency }: { labels: string[]; values: number[]; height?: number; currency?: boolean }) {
  const base = useBase(currency);
  const options: ApexOptions = {
    ...base,
    chart: { ...base.chart, type: "donut" },
    labels,
    legend: { position: "bottom", fontSize: "12px" },
    stroke: { width: 0 },
    plotOptions: { pie: { donut: { size: "68%", labels: { show: true, total: { show: true, label: "Total", formatter: (w) => { const t = (w.globals.seriesTotals as number[]).reduce((a, b) => a + b, 0); return currency ? fmtShort(t) : formatNumber(t); } } } } } },
  };
  if (!values.length || values.every((v) => v === 0)) return <div className="flex h-48 items-center justify-center text-sm text-gray-400">Aucune donnée sur la période</div>;
  return <ReactApexChart options={options} series={values} type="donut" height={height} />;
}
