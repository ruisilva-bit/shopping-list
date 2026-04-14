"use client";

import { useMemo } from "react";
import { useShopping } from "../../context/ShoppingContext";

const TOP_PRODUCTS_LIMIT = 10;
const WEEK_IN_MS = 7 * 24 * 60 * 60 * 1000;

type ProductInsight = {
  id: string;
  name: string;
  supermarkets: string[];
  purchaseCount: number;
  currentListCount: number;
  lastPurchaseAt: string | null;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function formatDate(value: string | null) {
  if (!value) {
    return "No purchases yet";
  }

  const parsedMs = Date.parse(value);
  if (Number.isNaN(parsedMs)) {
    return value;
  }

  return new Date(parsedMs).toLocaleString();
}

export default function DashboardPage() {
  const { templates, products } = useShopping();

  const currentCountsByName = useMemo(() => {
    const counts = new Map<string, number>();

    products.forEach((product) => {
      const key = normalizeName(product.name);
      if (!key) {
        return;
      }

      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    return counts;
  }, [products]);

  const insights = useMemo(() => {
    const rowsByName = new Map<string, ProductInsight>();

    templates.forEach((template) => {
      const key = normalizeName(template.name);
      if (!key) {
        return;
      }

      const validPurchases = template.purchaseLog
        .map((entry) => Date.parse(entry))
        .filter((value) => !Number.isNaN(value))
        .sort((a, b) => b - a);

      const lastPurchaseAt = validPurchases.length > 0 ? new Date(validPurchases[0]).toISOString() : null;
      const currentListCount = currentCountsByName.get(key) ?? 0;

      rowsByName.set(key, {
        id: template.id,
        name: template.name,
        supermarkets: template.supermarkets,
        purchaseCount: validPurchases.length,
        currentListCount,
        lastPurchaseAt
      });
    });

    products.forEach((product) => {
      const key = normalizeName(product.name);
      if (!key || rowsByName.has(key)) {
        return;
      }

      rowsByName.set(key, {
        id: product.id,
        name: product.name,
        supermarkets: product.supermarkets,
        purchaseCount: 0,
        currentListCount: currentCountsByName.get(key) ?? 0,
        lastPurchaseAt: null
      });
    });

    return Array.from(rowsByName.values()).sort((a, b) => {
      if (a.purchaseCount !== b.purchaseCount) {
        return b.purchaseCount - a.purchaseCount;
      }

      if (a.currentListCount !== b.currentListCount) {
        return b.currentListCount - a.currentListCount;
      }

      return a.name.localeCompare(b.name);
    });
  }, [currentCountsByName, products, templates]);

  const totalPurchases = useMemo(
    () => insights.reduce((sum, item) => sum + item.purchaseCount, 0),
    [insights]
  );

  const purchasesThisWeek = useMemo(() => {
    const cutoff = Date.now() - WEEK_IN_MS;

    return templates.reduce((sum, template) => {
      const weeklyLogs = template.purchaseLog.filter((entry) => {
        const parsedMs = Date.parse(entry);
        return !Number.isNaN(parsedMs) && parsedMs >= cutoff;
      });

      return sum + weeklyLogs.length;
    }, 0);
  }, [templates]);

  const topProducts = insights.slice(0, TOP_PRODUCTS_LIMIT);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-100">
          Dashboard
        </p>
        <h2 className="mt-1 text-2xl font-bold">Most Common Products</h2>
        <p className="mt-2 text-sm text-emerald-50">
          Ranked using purchase history, with current list presence as a tie-breaker.
        </p>
      </section>

      <section className="grid gap-2.5 sm:grid-cols-3">
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Ranked Items
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{insights.length}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Total Purchases
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{totalPurchases}</p>
        </article>
        <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            Purchases This Week
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{purchasesThisWeek}</p>
        </article>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-900">Top Products</h3>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            Top {Math.min(topProducts.length, TOP_PRODUCTS_LIMIT)}
          </span>
        </div>

        {topProducts.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600">
            No products found yet. Add products and mark them as bought to build insights.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {topProducts.map((item, index) => (
              <article
                key={item.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {index + 1}. {item.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Last purchase: {formatDate(item.lastPurchaseAt)}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-lg bg-white px-2 py-1 text-right ring-1 ring-slate-200">
                    <p className="text-[11px] uppercase tracking-wide text-slate-500">Bought</p>
                    <p className="text-sm font-bold text-slate-900">{item.purchaseCount}x</p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    In list: {item.currentListCount}
                  </span>
                  {item.supermarkets.map((market) => (
                    <span
                      key={`${item.id}-${market}`}
                      className="rounded-full bg-white px-2 py-0.5 text-[11px] text-slate-700 ring-1 ring-slate-200"
                    >
                      {market}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
