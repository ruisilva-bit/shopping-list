"use client";

import { useMemo, useState } from "react";
import { useShopping } from "../../context/ShoppingContext";
import { Product, ProductTemplate } from "../../types";

const TOP_PRODUCTS_LIMIT = 8;
const RECENT_PURCHASES_PREVIEW_LIMIT = 8;
const RESTOCK_LIMIT = 8;

type ProductHistoryInsight = {
  id: string;
  name: string;
  supermarkets: string[];
  purchaseCount: number;
};

type StoreInsight = {
  name: string;
  pendingCount: number;
  boughtCount: number;
  totalCount: number;
};

type RecentPurchase = {
  templateId: string;
  productName: string;
  boughtAt: string;
};

function normalizeName(value: string) {
  return value.trim().toLowerCase();
}

function parseValidDates(values: string[]) {
  return values
    .map((value) => Date.parse(value))
    .filter((timestamp) => !Number.isNaN(timestamp));
}

function formatDateTime(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return isoDate;
  }
}

function buildProductHistory(templates: ProductTemplate[]) {
  return templates
    .map((template) => ({
      id: template.id,
      name: template.name,
      supermarkets: template.supermarkets,
      purchaseCount: parseValidDates(template.purchaseLog).length
    }))
    .filter((item) => item.purchaseCount > 0)
    .sort((a, b) => {
      if (a.purchaseCount !== b.purchaseCount) {
        return b.purchaseCount - a.purchaseCount;
      }

      return a.name.localeCompare(b.name);
    });
}

function buildRecentPurchases(templates: ProductTemplate[]) {
  const logs: RecentPurchase[] = [];

  templates.forEach((template) => {
    template.purchaseLog.forEach((entry) => {
      if (!Number.isNaN(Date.parse(entry))) {
        logs.push({
          templateId: template.id,
          productName: template.name,
          boughtAt: entry
        });
      }
    });
  });

  return logs.sort((a, b) => Date.parse(b.boughtAt) - Date.parse(a.boughtAt));
}

function buildStoreInsights(products: Product[]) {
  const map = new Map<string, StoreInsight>();

  products.forEach((product) => {
    product.supermarkets.forEach((market) => {
      const existing = map.get(market) ?? {
        name: market,
        pendingCount: 0,
        boughtCount: 0,
        totalCount: 0
      };

      existing.totalCount += 1;
      if (product.isBought) {
        existing.boughtCount += 1;
      } else {
        existing.pendingCount += 1;
      }

      map.set(market, existing);
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    if (a.pendingCount !== b.pendingCount) {
      return b.pendingCount - a.pendingCount;
    }

    if (a.totalCount !== b.totalCount) {
      return b.totalCount - a.totalCount;
    }

    return a.name.localeCompare(b.name);
  });
}

function buildRestockCandidates(templates: ProductTemplate[], products: Product[]) {
  const currentNames = new Set(products.map((product) => normalizeName(product.name)).filter(Boolean));

  return buildProductHistory(templates)
    .filter((item) => !currentNames.has(normalizeName(item.name)))
    .slice(0, RESTOCK_LIMIT);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none text-slate-900">{value}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { templates, products, supermarkets } = useShopping();
  const [showAllRecentPurchases, setShowAllRecentPurchases] = useState(false);

  const productHistory = useMemo(() => buildProductHistory(templates), [templates]);
  const recentPurchases = useMemo(() => buildRecentPurchases(templates), [templates]);
  const storeInsights = useMemo(() => buildStoreInsights(products), [products]);
  const restockCandidates = useMemo(() => buildRestockCandidates(templates, products), [products, templates]);

  const pendingProducts = products.filter((product) => !product.isBought);
  const boughtProducts = products.filter((product) => product.isBought);
  const totalPurchaseHistory = productHistory.reduce((sum, item) => sum + item.purchaseCount, 0);
  const topProducts = productHistory.slice(0, TOP_PRODUCTS_LIMIT);
  const visibleRecentPurchases = showAllRecentPurchases
    ? recentPurchases
    : recentPurchases.slice(0, RECENT_PURCHASES_PREVIEW_LIMIT);
  const hiddenRecentPurchasesCount = Math.max(
    recentPurchases.length - RECENT_PURCHASES_PREVIEW_LIMIT,
    0
  );
  const topStores = storeInsights.slice(0, 6);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-4 text-white shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">Dashboard</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">Resumo</h2>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Por comprar" value={pendingProducts.length} />
        <StatCard label="Comprados" value={boughtProducts.length} />
        <StatCard label="Histórico" value={totalPurchaseHistory} />
        <StatCard label="Supermercados" value={supermarkets.length} />
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Mais comprados</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {topProducts.length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {topProducts.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Sem histórico
              </p>
            ) : (
              topProducts.map((item, index) => (
                <article
                  key={`top-${item.id}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {index + 1}. {item.name}
                      </p>
                      {item.supermarkets.length > 0 ? (
                        <p className="mt-1 text-xs text-slate-500">{item.supermarkets.join(" · ")}</p>
                      ) : null}
                    </div>
                    <div className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {item.purchaseCount}
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Últimas compras</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {recentPurchases.length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {recentPurchases.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Sem registos
              </p>
            ) : (
              <>
                {visibleRecentPurchases.map((entry) => (
                  <article
                    key={`${entry.templateId}-${entry.boughtAt}`}
                    className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                  >
                    <p className="text-sm font-semibold text-slate-900">{entry.productName}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.boughtAt)}</p>
                  </article>
                ))}

                {hiddenRecentPurchasesCount > 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllRecentPurchases((current) => !current)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    {showAllRecentPurchases
                      ? "Mostrar menos"
                      : `Mostrar mais ${hiddenRecentPurchasesCount}`}
                  </button>
                ) : null}
              </>
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Por supermercado</h3>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Lista atual
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {topStores.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Sem dados
              </p>
            ) : (
              topStores.map((store) => (
                <article
                  key={store.name}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{store.name}</p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-200">
                      {store.totalCount}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                    <div className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Por comprar</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{store.pendingCount}</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Comprados</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{store.boughtCount}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900">Repor</h3>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Sugestões
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {restockCandidates.length === 0 ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-6 text-center text-sm text-emerald-700">
                Nada a sugerir
              </p>
            ) : (
              restockCandidates.map((item) => (
                <article
                  key={`candidate-${item.id}`}
                  className="rounded-2xl border border-amber-200 bg-amber-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-amber-900">{item.name}</p>
                    <span className="text-xs font-semibold text-amber-800">{item.purchaseCount}x</span>
                  </div>
                  {item.supermarkets.length > 0 ? (
                    <p className="mt-1 text-xs text-amber-700">{item.supermarkets.join(" · ")}</p>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
