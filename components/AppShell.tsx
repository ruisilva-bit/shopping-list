"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
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

function getLinkClasses(isActive: boolean) {
  return isActive
    ? "rounded-full bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition"
    : "rounded-full bg-white px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100";
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { filteredProducts, openAddModal, syncMode, syncError } = useShopping();
  const missingToBuyCount = filteredProducts.filter((product) => !product.isBought).length;

  return (
    <div className="min-h-screen bg-white">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-2.5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Shopping Planner
              </p>
              <h1 className="text-2xl font-bold leading-tight text-slate-900">Shopping List</h1>
            </div>

            <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-1.5">
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700">
                Products {missingToBuyCount}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  syncMode === "cloud"
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {syncMode === "cloud" ? "Cloud sync" : "Local mode"}
              </span>
            </div>
          </div>

          {syncError ? (
            <p className="text-xs text-amber-700">{syncError}</p>
          ) : null}

          <nav className="hidden items-center justify-end gap-2 sm:flex" aria-label="Desktop navigation">
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-full bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500"
            >
              Add product
            </button>
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;

              return (
                <Link key={item.href} href={item.href} className={getLinkClasses(isActive)}>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-3 pb-24 pt-2.5 sm:px-4 sm:pb-8">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden"
        aria-label="Mobile navigation"
      >
        <div className="mx-auto grid w-full max-w-4xl grid-cols-4 gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="rounded-xl bg-emerald-600 py-2 text-center text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Add
          </button>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? "rounded-xl bg-slate-900 py-2 text-center text-sm font-semibold text-white transition"
                    : "rounded-xl bg-white py-2 text-center text-sm font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100"
                }
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <AddProductModal />
    </div>
  );
}
