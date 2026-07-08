"use client";

import { useMemo } from "react";
import { useShopping } from "../../context/ShoppingContext";
import { Product, ProductTemplate } from "../../types";

const TOP_PRODUCTS_LIMIT = 6;
const RESTOCK_LIMIT = 6;
const RECENT_LIMIT = 6;

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
        historicalPurchases: 0
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
        historicalPurchases: 0
      };

      existing.historicalPurchases += purchaseCount;
      map.set(market, existing);
    });
  });

  return Array.from(map.values()).sort((a, b) => {
    const aScore = a.pendingCount * 3 + a.historicalPurchases + a.boughtCount;
    const bScore = b.pendingCount * 3 + b.historicalPurchases + b.boughtCount;
    return bScore - aScore;
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

  return logs
    .sort((a, b) => Date.parse(b.boughtAt) - Date.parse(a.boughtAt))
    .slice(0, RECENT_LIMIT);
}

function StatCard({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold leading-none text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{hint}</p>
    </article>
  );
}

export default function DashboardPage() {
  const { templates, products } = useShopping();

  const productInsights = useMemo(() => buildProductInsights(templates, products), [templates, products]);
  const storeInsights = useMemo(() => buildStoreInsights(templates, products), [templates, products]);
  const recentPurchases = useMemo(() => buildRecentPurchases(templates), [templates]);

  const pendingProducts = products.filter((product) => !product.isBought);
  const boughtProducts = products.filter((product) => product.isBought);
  const totalPurchases = productInsights.reduce((sum, item) => sum + item.purchaseCount, 0);
  const topProducts = productInsights.slice(0, TOP_PRODUCTS_LIMIT);
  const topStores = storeInsights.slice(0, 4);
  const restockCandidates = productInsights
    .filter((item) => item.purchaseCount > 0 && item.inListCount === 0)
    .slice(0, RESTOCK_LIMIT);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-600 via-emerald-500 to-teal-500 p-4 text-white shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-emerald-100">Dashboard</p>
        <h2 className="mt-1 text-2xl font-bold leading-tight">Resumo rápido da tua lista</h2>
        <p className="mt-2 max-w-xl text-sm text-emerald-50">
          Vista mais simples e mobile-first para perceber rapidamente o que falta comprar, o que compras mais e em que supermercados tens mais carga.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Por comprar"
          value={pendingProducts.length}
          hint="Itens ainda ativos na lista"
        />
        <StatCard
          label="Comprados"
          value={boughtProducts.length}
          hint="Itens já marcados nesta ronda"
        />
        <StatCard
          label="Compras históricas"
          value={totalPurchases}
          hint="Total registado na base de dados"
        />
        <StatCard
          label="Supermercados"
          value={storeInsights.length}
          hint="Lojas com produtos associados"
        />
      </section>

      <section className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Mais comprados</h3>
              <p className="mt-1 text-xs text-slate-500">Os produtos com mais compras registadas.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              Top {topProducts.length}
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {topProducts.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Ainda não há histórico suficiente.
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
                      <p className="mt-1 text-xs text-slate-500">
                        {item.supermarkets.length > 0
                          ? item.supermarkets.join(" · ")
                          : "Sem supermercado associado"}
                      </p>
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
          <div>
            <h3 className="text-base font-semibold text-slate-900">Últimas compras</h3>
            <p className="mt-1 text-xs text-slate-500">Os registos mais recentes na base de dados.</p>
          </div>

          <div className="mt-3 space-y-2">
            {recentPurchases.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Ainda não há compras registadas.
              </p>
            ) : (
              recentPurchases.map((entry) => (
                <article
                  key={`${entry.templateId}-${entry.boughtAt}`}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-3"
                >
                  <p className="text-sm font-semibold text-slate-900">{entry.productName}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatDateTime(entry.boughtAt)}</p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Supermercados com mais carga</h3>
              <p className="mt-1 text-xs text-slate-500">Ajuda a perceber onde tens mais coisas pendentes.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
              {topStores.length} visíveis
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {topStores.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
                Liga produtos a supermercados para aparecerem aqui.
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
                      {store.pendingCount} pendente(s)
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Pendentes</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{store.pendingCount}</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Comprados</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{store.boughtCount}</p>
                    </div>
                    <div className="rounded-xl bg-white px-2 py-2 ring-1 ring-slate-200">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Histórico</p>
                      <p className="mt-1 text-sm font-bold text-slate-900">{store.historicalPurchases}</p>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Sugestões para repor</h3>
              <p className="mt-1 text-xs text-slate-500">Produtos comprados no passado e que agora não estão na lista.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
              Histórico
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {restockCandidates.length === 0 ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-6 text-center text-sm text-emerald-700">
                Boa — os produtos recorrentes já estão cobertos.
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
                  <p className="mt-1 text-xs text-amber-700">
                    {item.supermarkets.length > 0
                      ? `Costuma aparecer em: ${item.supermarkets.join(" · ")}`
                      : "Sem supermercados associados"}
                  </p>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
