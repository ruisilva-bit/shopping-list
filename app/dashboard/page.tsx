"use client";

import { useEffect, useMemo, useState } from "react";
import { useShopping } from "../../context/ShoppingContext";
import { Product, ProductTemplate } from "../../types";

const TOP_PRODUCTS_LIMIT = 10;
const STORE_INSIGHTS_LIMIT = 6;
const TREND_WEEKS = 10;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;
const TREND_DETAIL_PRODUCTS_LIMIT = 8;
const RESTOCK_LIMIT = 5;

type TrendProductDetail = {
  name: string;
  count: number;
};

type TrendPoint = {
  label: string;
  startMs: number;
  endMs: number;
  count: number;
  uniqueProducts: number;
  topProducts: TrendProductDetail[];
};

type ProductInsight = {
  id: string;
  name: string;
  supermarkets: string[];
  purchaseCount: number;
  inListCount: number;
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

function formatWeekLabel(timestampMs: number) {
  return new Date(timestampMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
}

function formatWeekRange(startMs: number, endMs: number) {
  const start = new Date(startMs).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  const end = new Date(endMs - 1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric"
  });
  return `${start} - ${end}`;
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
  const nowMs = Date.now();
  const currentWeekStart = getWeekStartMs(new Date(nowMs));
  const firstWeekStart = currentWeekStart - (TREND_WEEKS - 1) * WEEK_IN_MS;

  const buckets = Array.from({ length: TREND_WEEKS }, (_, index) => ({
    startMs: firstWeekStart + index * WEEK_IN_MS,
    endMs: firstWeekStart + (index + 1) * WEEK_IN_MS,
    count: 0,
    productCounts: new Map<string, number>()
  }));

  templates.forEach((template) => {
    const productName = template.name.trim();
    if (!productName) {
      return;
    }

    parseValidDates(template.purchaseLog).forEach((logMs) => {
      if (logMs < firstWeekStart || logMs >= currentWeekStart + WEEK_IN_MS) {
        return;
      }

      const bucketIndex = Math.floor((logMs - firstWeekStart) / WEEK_IN_MS);
      const bucket = buckets[bucketIndex];

      if (!bucket) {
        return;
      }

      bucket.count += 1;
      bucket.productCounts.set(productName, (bucket.productCounts.get(productName) ?? 0) + 1);
    });
  });

  return buckets.map((bucket) => ({
    label: formatWeekLabel(bucket.startMs),
    startMs: bucket.startMs,
    endMs: bucket.endMs,
    count: bucket.count,
    uniqueProducts: bucket.productCounts.size,
    topProducts: Array.from(bucket.productCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        if (a.count !== b.count) {
          return b.count - a.count;
        }
        return a.name.localeCompare(b.name);
      })
  }));
}

function buildProductInsights(templates: ProductTemplate[], products: Product[]) {
  const map = new Map<string, ProductInsight>();

  templates.forEach((template) => {
    const key = normalizeName(template.name);
    if (!key) {
      return;
    }

    map.set(key, {
      id: template.id,
      name: template.name,
      supermarkets: template.supermarkets,
      purchaseCount: parseValidDates(template.purchaseLog).length,
      inListCount: 0
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
      inListCount: 1
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
  selectedIndex: number;
  onSelect: (index: number) => void;
};

function TrendChart({ points, selectedIndex, onSelect }: TrendChartProps) {
  const maxValue = Math.max(1, ...points.map((point) => point.count));

  return (
    <div className="rounded-xl bg-slate-900/[0.03] p-2.5">
      <div className="flex h-44 items-end gap-1.5 sm:h-52 sm:gap-2">
        {points.map((point, index) => {
          const isActive = index === selectedIndex;
          const barHeight = Math.max(16, Math.round((point.count / maxValue) * 140));

          return (
            <button
              key={`trend-${point.startMs}`}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={isActive}
              aria-label={`${point.label}: ${point.count} purchases`}
              className={`group flex min-w-0 flex-1 flex-col items-center justify-end rounded-lg px-1 pb-1 pt-2 transition ${
                isActive
                  ? "bg-slate-900/10 ring-1 ring-slate-300"
                  : "hover:bg-slate-900/5"
              }`}
            >
              <span
                className={`mb-1 text-[10px] font-semibold ${
                  isActive ? "text-slate-800" : "text-slate-500 group-hover:text-slate-700"
                }`}
              >
                {point.count}
              </span>
              <span
                className={`block w-full rounded-md bg-gradient-to-t ${
                  isActive
                    ? "from-cyan-600 to-emerald-500"
                    : "from-cyan-500/80 to-emerald-400/80"
                }`}
                style={{ height: `${barHeight}px` }}
              />
              <span
                className={`mt-1.5 block truncate text-[10px] ${
                  isActive ? "font-semibold text-slate-800" : "text-slate-500"
                }`}
              >
                {point.label}
              </span>
            </button>
          );
        })}
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

type TopProductsBarChartProps = {
  items: ProductInsight[];
};

function TopProductsBarChart({ items }: TopProductsBarChartProps) {
  const maxValue = Math.max(1, ...items.map((item) => item.purchaseCount));

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const widthPercent = Math.max(2, (item.purchaseCount / maxValue) * 100);
        return (
          <article
            key={`top-product-${item.id}`}
            className="grid gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-sm font-semibold text-slate-900">
                {index + 1}. {item.name}
              </p>
              <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                {item.purchaseCount}
              </span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500"
                style={{ width: `${widthPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-slate-500">Current list quantity: {item.inListCount}</p>
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

  const [selectedTrendIndex, setSelectedTrendIndex] = useState(TREND_WEEKS - 1);

  useEffect(() => {
    setSelectedTrendIndex((current) => {
      if (trendSeries.length === 0) {
        return 0;
      }

      if (current < 0 || current >= trendSeries.length) {
        return trendSeries.length - 1;
      }

      return current;
    });
  }, [trendSeries.length]);

  const selectedTrend = trendSeries[selectedTrendIndex] ?? null;
  const topProducts = productInsights.slice(0, TOP_PRODUCTS_LIMIT);
  const topStores = storeInsights.slice(0, STORE_INSIGHTS_LIMIT);
  const totalPurchases = productInsights.reduce((sum, item) => sum + item.purchaseCount, 0);
  const thisWeekPurchases = trendSeries[trendSeries.length - 1]?.count ?? 0;
  const pendingCount = products.filter((product) => !product.isBought).length;
  const boughtCount = products.filter((product) => product.isBought).length;

  const restockCandidates = productInsights
    .filter((item) => item.purchaseCount > 0 && item.inListCount === 0)
    .slice(0, RESTOCK_LIMIT);

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
            Click a bar to inspect that week in detail.
          </p>
          <div className="mt-3">
            <TrendChart
              points={trendSeries}
              selectedIndex={selectedTrendIndex}
              onSelect={setSelectedTrendIndex}
            />
          </div>

          {selectedTrend ? (
            <section className="mt-3 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-teal-700">
                    Selected Week
                  </p>
                  <p className="text-sm font-semibold text-teal-900">
                    {formatWeekRange(selectedTrend.startMs, selectedTrend.endMs)}
                  </p>
                </div>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">
                  {selectedTrend.count} purchases
                </span>
              </div>

              <p className="mt-2 text-xs text-teal-700">
                {selectedTrend.uniqueProducts} unique product(s) purchased.
              </p>

              {selectedTrend.topProducts.length === 0 ? (
                <p className="mt-2 rounded-lg bg-white px-2.5 py-2 text-xs text-slate-600 ring-1 ring-teal-100">
                  No purchases were recorded in this week.
                </p>
              ) : (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  {selectedTrend.topProducts.slice(0, TREND_DETAIL_PRODUCTS_LIMIT).map((entry) => (
                    <div
                      key={`${selectedTrend.startMs}-${entry.name}`}
                      className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 ring-1 ring-teal-100"
                    >
                      <span className="truncate text-xs font-medium text-slate-700">{entry.name}</span>
                      <span className="text-xs font-semibold text-slate-900">{entry.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          ) : null}
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
            <h3 className="text-base font-semibold text-slate-900">Top 10 Products By Quantity</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Quantity purchased
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Bar graph of products with the highest purchase quantity in history.
          </p>
          <div className="mt-3">
            {topProducts.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Start buying items to populate this chart.
              </p>
            ) : (
              <TopProductsBarChart items={topProducts} />
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
