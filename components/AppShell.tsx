"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import AddProductModal from "./AddProductModal";
import { useShopping } from "../context/ShoppingContext";

const NAV_ITEMS = [
  { href: "/", label: "Products" },
  { href: "/database", label: "Database" },
  { href: "/supermarkets", label: "Stores" }
];

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { filteredProducts, openAddModal, syncMode, syncError } = useShopping();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const missingToBuyCount = filteredProducts.filter((product) => !product.isBought).length;

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
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Shopping Planner
              </p>
              <h1 className="text-2xl font-bold leading-tight text-slate-900">Shopping List</h1>
            </div>
          </div>

          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setIsSidebarOpen(true)}
            className="rounded-xl border border-slate-200 p-2 text-slate-700 transition hover:bg-slate-100"
          >
            <span className="mb-1 block h-0.5 w-5 rounded bg-current" />
            <span className="mb-1 block h-0.5 w-5 rounded bg-current" />
            <span className="block h-0.5 w-5 rounded bg-current" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-2.5 sm:px-4">{children}</main>

      <button
        type="button"
        onClick={openAddModal}
        aria-label="Add product"
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
          aria-label="Close menu"
          onClick={() => setIsSidebarOpen(false)}
          className={`absolute inset-0 bg-slate-950/35 transition-opacity ${
            isSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
        />

        <aside
          className={`absolute right-0 top-0 h-full w-72 max-w-[84vw] border-l border-slate-200 bg-white p-4 shadow-xl transition-transform ${
            isSidebarOpen ? "translate-x-0" : "translate-x-full"
          }`}
          aria-label="Sidebar menu"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Menu</h2>
            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            >
              Close
            </button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500">
              Overview
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-slate-200 bg-white p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Products</p>
                <p className="mt-0.5 text-xl font-bold leading-none text-slate-900">
                  {missingToBuyCount}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-2">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Sync</p>
                <p
                  className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                    syncMode === "cloud"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      syncMode === "cloud" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                  {syncMode === "cloud" ? "Cloud sync" : "Local mode"}
                </p>
              </div>
            </div>

            {syncError ? (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
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
                      ? "block rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                      : "block rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
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
