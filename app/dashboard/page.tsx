"use client";

import { useMemo } from "react";
import { useShopping } from "../../context/ShoppingContext";
import { Product, ProductTemplate } from "../../types";

const TOP_PRODUCTS_LIMIT = 7;
const STORE_INSIGHTS_LIMIT = 6;
const TREND_WEEKS = 10;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

type TrendPoint = {
  label: string;
  count: number;
};

type ProductInsight = {
  id: string;
  name: string;
  supermarkets: string[];
  purchaseCount: number;
  inListCount: number;
  lastPurchaseMs: number | null;
};

type StoreInsight = {
  name: string;
  pendingCount: number;
  boughtCount: number;
  historicalPurchases: number;
  score: number;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseValidDates(values: string[]) {
  return values
    .map((value) => Date.parse(value))
    .filter((timestamp) => !Number.isNaN(timestamp));
}

function getWeekStartMs(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.getTime();
}

function formatDateTime(timestampMs: number | null) {
  if (!timestampMs) {
    return "No purchases yet";
  }

  return new Date(timestampMs).toLocaleString();
}

function formatWeekLabel(timestampMs: number) {
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatPercentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatCompactNumber(value: number) {
  return new Intl.NumberFormat(undefined, {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

function buildTrendSeries(templates: ProductTemplate[]) {
  const allLogs = templates.flatMap((template) => parseValidDates(template.purchaseLog));
  const nowMs = Date.now();
  const currentWeekStart = getWeekStartMs(new Date(nowMs));
  const firstWeekStart = currentWeekStart - (TREND_WEEKS - 1) * WEEK_IN_MS;

  return Array.from({ length: TREND_WEEKS }, (_, index) => {
    const startMs = firstWeekStart + index * WEEK_IN_MS;
    const endMs = startMs + WEEK_IN_MS;
    const count = allLogs.filter((logMs) => logMs >= startMs && logMs < endMs).length;

    return {
      label: formatWeekLabel(startMs),
      count
    };
  });
}

function buildProductInsights(templates: ProductTemplate[], products: Product[]) {
  const map = new Map<string, ProductInsight>();

  templates.forEach((template) => {
    const key = normalizeName(template.name);
    if (!key) {
      return;
    }

    const timestamps = parseValidDates(template.purchaseLog).sort((a, b) => b - a);
    map.set(key, {
      id: template.id,
      name: template.name,
      supermarkets: template.supermarkets,
      purchaseCount: timestamps.length,
      inListCount: 0,
      lastPurchaseMs: timestamps[0] ?? null
    });
  });

  products.forEach((product) => {
    const key = normalizeName(product.name);
    if (!key) {
      return;
    }

    const existing = map.get(key);
    if (existing) {
      existing.inListCount += 1;
      if (existing.supermarkets.length === 0 && product.supermarkets.length > 0) {
        existing.supermarkets = product.supermarkets;
      }
      return;
    }

    map.set(key, {
      id: product.id,
      name: product.name,
      supermarkets: product.supermarkets,
      purchaseCount: 0,
      inListCount: 1,
      lastPurchaseMs: null
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.purchaseCount !== b.purchaseCount) {
      return b.purchaseCount - a.purchaseCount;
    }

    if (a.inListCount !== b.inListCount) {
      return b.inListCount - a.inListCount;
    }

    return a.name.localeCompare(b.name);
  });
}

function buildStoreInsights(templates: ProductTemplate[], products: Product[]) {
  const map = new Map<string, StoreInsight>();

  products.forEach((product) => {
    product.supermarkets.forEach((market) => {
      const existing = map.get(market) ?? {
        name: market,
        pendingCount: 0,
        boughtCount: 0,
        historicalPurchases: 0,
        score: 0
      };

      if (product.isBought) {
        existing.boughtCount += 1;
      } else {
        existing.pendingCount += 1;
      }

      map.set(market, existing);
    });
  });

  templates.forEach((template) => {
    const purchaseCount = parseValidDates(template.purchaseLog).length;
    template.supermarkets.forEach((market) => {
      const existing = map.get(market) ?? {
        name: market,
        pendingCount: 0,
        boughtCount: 0,
        historicalPurchases: 0,
        score: 0
      };

      existing.historicalPurchases += purchaseCount;
      map.set(market, existing);
    });
  });

  return Array.from(map.values())
    .map((item) => ({
      ...item,
      score: item.historicalPurchases + item.pendingCount * 2 + item.boughtCount
    }))
    .sort((a, b) => b.score - a.score);
}

type TrendChartProps = {
  points: TrendPoint[];
};

function TrendChart({ points }: TrendChartProps) {
  const width = 640;
  const height = 240;
  const paddingX = 20;
  const paddingY = 20;
  const maxValue = Math.max(1, ...points.map((point) => point.count));
  const innerWidth = width - paddingX * 2;
  const innerHeight = height - paddingY * 2;

  const chartPoints = points.map((point, index) => {
    const x = paddingX + (index / Math.max(1, points.length - 1)) * innerWidth;
    const y = paddingY + innerHeight - (point.count / maxValue) * innerHeight;
    return { ...point, x, y };
  });

  const linePath = chartPoints
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${paddingX + innerWidth} ${paddingY + innerHeight} L ${paddingX} ${paddingY + innerHeight} Z`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-44 w-full rounded-xl bg-slate-900/[0.03] p-1 sm:h-56"
        aria-label="Weekly purchase trend chart"
      >
        <defs>
          <linearGradient id="trendAreaFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="trendLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#06b6d4" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((ratio) => (
          <line
            key={`grid-${ratio}`}
            x1={paddingX}
            x2={paddingX + innerWidth}
            y1={paddingY + innerHeight * ratio}
            y2={paddingY + innerHeight * ratio}
            className="stroke-slate-300"
            strokeWidth="1"
            strokeDasharray="4 5"
            opacity="0.6"
          />
        ))}

        <path d={areaPath} fill="url(#trendAreaFill)" />
        <path d={linePath} fill="none" stroke="url(#trendLine)" strokeWidth="3" strokeLinecap="round" />

        {chartPoints.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="#0f172a"
            className="drop-shadow-sm"
          />
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-5 gap-1 text-[11px] font-medium text-slate-500 sm:grid-cols-10">
        {points.map((point) => (
          <span key={`label-${point.label}`} className="truncate text-center">
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}

type StatusDonutProps = {
  boughtCount: number;
  pendingCount: number;
};

function StatusDonut({ boughtCount, pendingCount }: StatusDonutProps) {
  const total = boughtCount + pendingCount;
  const boughtRatio = total === 0 ? 0 : boughtCount / total;
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference * boughtRatio;

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-28 w-28 shrink-0">
        <svg viewBox="0 0 120 120" className="h-28 w-28 -rotate-90">
          <circle cx="60" cy="60" r={radius} stroke="#e2e8f0" strokeWidth="14" fill="none" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            stroke="#14b8a6"
            strokeWidth="14"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${progress} ${circumference}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Bought</p>
          <p className="text-xl font-bold text-slate-900">{formatPercentage(boughtRatio)}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        <div className="rounded-lg bg-emerald-50 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
            Bought
          </p>
          <p className="font-semibold text-emerald-800">{boughtCount} items</p>
        </div>
        <div className="rounded-lg bg-slate-100 px-2.5 py-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
            Pending
          </p>
          <p className="font-semibold text-slate-800">{pendingCount} items</p>
        </div>
      </div>
    </div>
  );
}

type ProductBarsProps = {
  items: ProductInsight[];
};

function ProductBars({ items }: ProductBarsProps) {
  const maxValue = Math.max(1, ...items.map((item) => item.purchaseCount));

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const width = `${(item.purchaseCount / maxValue) * 100}%`;
        return (
          <article key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {index + 1}. {item.name}
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                {item.purchaseCount} purchases
              </span>
            </div>

            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
                style={{ width }}
              />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-700">
                In list: {item.inListCount}
              </span>
              <span className="text-slate-500">Last: {formatDateTime(item.lastPurchaseMs)}</span>
            </div>
          </article>
        );
      })}
    </div>
  );
}

type StoreBarsProps = {
  items: StoreInsight[];
};

function StoreBars({ items }: StoreBarsProps) {
  const maxHistory = Math.max(1, ...items.map((item) => item.historicalPurchases));
  const maxPending = Math.max(1, ...items.map((item) => item.pendingCount));

  return (
    <div className="space-y-2.5">
      {items.map((item) => (
        <article key={item.name} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">{item.name}</p>
            <span className="text-xs font-semibold text-slate-500">
              Score {formatCompactNumber(item.score)}
            </span>
          </div>

          <div className="mt-2 space-y-1.5">
            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Pending in list</span>
                <span>{item.pendingCount}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${(item.pendingCount / maxPending) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Historical purchases</span>
                <span>{item.historicalPurchases}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-teal-500 to-cyan-500"
                  style={{ width: `${(item.historicalPurchases / maxHistory) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { templates, products } = useShopping();

  const trendSeries = useMemo(() => buildTrendSeries(templates), [templates]);
  const productInsights = useMemo(() => buildProductInsights(templates, products), [templates, products]);
  const storeInsights = useMemo(() => buildStoreInsights(templates, products), [templates, products]);

  const topProducts = productInsights.slice(0, TOP_PRODUCTS_LIMIT);
  const topStores = storeInsights.slice(0, STORE_INSIGHTS_LIMIT);
  const totalPurchases = productInsights.reduce((sum, item) => sum + item.purchaseCount, 0);
  const thisWeekPurchases = trendSeries[trendSeries.length - 1]?.count ?? 0;
  const pendingCount = products.filter((product) => !product.isBought).length;
  const boughtCount = products.filter((product) => product.isBought).length;

  const restockCandidates = productInsights
    .filter((item) => item.purchaseCount > 0 && item.inListCount === 0)
    .slice(0, 5);

  const busiestProduct = productInsights[0];

  return (
    <div className="space-y-4">
      <section className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">Dashboard</p>
        <h2 className="mt-1 text-2xl font-bold">Smart Shopping Insights</h2>
        <p className="mt-2 max-w-2xl text-sm text-emerald-50">
          Track your buying habits, spotlight recurring products, and balance your list across stores.
        </p>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <article className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100">
              Total Purchases
            </p>
            <p className="mt-1 text-xl font-bold">{totalPurchases}</p>
          </article>
          <article className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100">
              This Week
            </p>
            <p className="mt-1 text-xl font-bold">{thisWeekPurchases}</p>
          </article>
          <article className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100">
              Pending Items
            </p>
            <p className="mt-1 text-xl font-bold">{pendingCount}</p>
          </article>
          <article className="rounded-xl bg-white/15 p-2.5 backdrop-blur-sm">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-100">
              Top Product
            </p>
            <p className="mt-1 truncate text-xl font-bold">{busiestProduct?.name ?? "No data"}</p>
          </article>
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Purchase Trend</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Last {TREND_WEEKS} weeks
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Helps identify when buying activity spikes or slows down.
          </p>
          <div className="mt-3">
            <TrendChart points={trendSeries} />
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">List Completion</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Live
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">Quick snapshot of what is done vs still missing.</p>
          <div className="mt-3">
            <StatusDonut boughtCount={boughtCount} pendingCount={pendingCount} />
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Most Common Products</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Top {Math.min(topProducts.length, TOP_PRODUCTS_LIMIT)}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Ranked by completed purchases, with current list presence included.
          </p>
          <div className="mt-3">
            {topProducts.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Start buying items to populate this chart.
              </p>
            ) : (
              <ProductBars items={topProducts} />
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Store Workload</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Pending + history
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Compare how much each store contributes to your shopping routine.
          </p>
          <div className="mt-3">
            {topStores.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Link supermarkets to products to unlock this view.
              </p>
            ) : (
              <StoreBars items={topStores} />
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Restock Suggestions</h3>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
            Based on history
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Frequently purchased products that are not currently in your list.
        </p>

        {restockCandidates.length === 0 ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
            Nice work. Your current list already includes your frequent products.
          </p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {restockCandidates.map((item) => (
              <article
                key={`candidate-${item.id}`}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2"
              >
                <p className="text-sm font-semibold text-amber-800">{item.name}</p>
                <p className="text-xs text-amber-700">{item.purchaseCount} previous purchases</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
