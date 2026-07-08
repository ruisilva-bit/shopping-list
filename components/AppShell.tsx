"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import AddProductModal from "./AddProductModal";
import { useShopping } from "../context/ShoppingContext";

const NAV_ITEMS = [
  { href: "/", label: "Início" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/database", label: "Base de dados" },
  { href: "/supermarkets", label: "Supermercados" }
];

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { filteredProducts, openAddModal, syncMode, syncError } = useShopping();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const pendingCount = useMemo(
    () => filteredProducts.filter((product) => !product.isBought).length,
    [filteredProducts]
  );

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = isSidebarOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isSidebarOpen]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-3 py-2.5 sm:px-4">
          <Link href="/" className="min-w-0 rounded-2xl transition hover:opacity-90">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-lg font-bold text-white shadow-sm">
                SL
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold leading-tight text-slate-900 sm:text-xl">
                  Shopping List
                </h1>
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:inline-flex">
              {pendingCount} por comprar
            </div>

            <button
              type="button"
              aria-label="Abrir menu"
              onClick={() => setIsSidebarOpen(true)}
              className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-100"
            >
              <span className="mb-1 block h-0.5 w-5 rounded bg-current" />
              <span className="mb-1 block h-0.5 w-5 rounded bg-current" />
              <span className="block h-0.5 w-5 rounded bg-current" />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-3 sm:px-4">{children}</main>

      <button
        type="button"
        onClick={openAddModal}
        aria-label="Adicionar produto"
        className="fixed bottom-5 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-3xl leading-none text-white shadow-lg transition hover:bg-emerald-500"
      >
        +
      </button>

      <div
        className={`fixed inset-0 z-40 transition ${
          isSidebarOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setIsSidebarOpen(false)}
          className={`absolute inset-0 bg-slate-950/35 transition-opacity ${
            isSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute right-0 top-0 flex h-full w-72 max-w-[84vw] flex-col border-l border-slate-200 bg-white p-4 shadow-xl transition-transform ${
            isSidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Menu lateral"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Menu</h2>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Por comprar</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{pendingCount}</p>
              </div>

              <div className="rounded-xl bg-white p-2 ring-1 ring-slate-200">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sync</p>
                <p
                  className={`mt-1 text-xs font-semibold ${
                    syncMode === "cloud" ? "text-emerald-700" : "text-amber-700"
                  }`}
                >
                  {syncMode === "cloud" ? "Cloud" : "Local"}
                </p>
              </div>
            </div>

            {syncError ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-700">
                {syncError}
              </p>
            ) : null}
          </div>

          <nav className="mt-4 space-y-2" aria-label="App navigation">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    isActive
                      ? "block rounded-xl bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white"
                      : "block rounded-xl bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

      <AddProductModal />
    </div>
  );
}
