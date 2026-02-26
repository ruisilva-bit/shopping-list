"use client";

import { MouseEvent, useEffect, useState } from "react";
import { ActionResult, Product } from "../types";

type ProductListProps = {
  products: Product[];
  supermarkets: string[];
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (id: string, name: string, supermarkets: string[]) => Promise<ActionResult>;
  onToggleBought: (id: string, isBought: boolean) => Promise<void>;
};

type ProductCardProps = {
  product: Product;
  supermarkets: string[];
  nowMs: number;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (id: string, name: string, supermarkets: string[]) => Promise<ActionResult>;
  onToggleBought: (id: string, isBought: boolean) => Promise<void>;
};

const ONE_HOUR_MS = 60 * 60 * 1000;

function getRemainingDeleteText(boughtAt: string | null, nowMs: number) {
  if (!boughtAt) {
    return null;
  }

  const boughtAtMs = Date.parse(boughtAt);
  if (Number.isNaN(boughtAtMs)) {
    return null;
  }

  const remainingMs = Math.max(0, ONE_HOUR_MS - (nowMs - boughtAtMs));
  const minutes = Math.floor(remainingMs / 60000);
  const seconds = Math.floor((remainingMs % 60000) / 1000);

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function ProductCard({
  product,
  supermarkets,
  nowMs,
  onDeleteProduct,
  onEditProduct,
  onToggleBought
}: ProductCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editSupermarkets, setEditSupermarkets] = useState<string[]>(product.supermarkets);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");

  const toggleEditSupermarket = (market: string) => {
    setEditSupermarkets((current) =>
      current.includes(market)
        ? current.filter((item) => item !== market)
        : [...current, market]
    );
  };

  const handleSaveEdit = async () => {
    const result = await onEditProduct(product.id, editName, editSupermarkets);
    if (!result.success) {
      setError(result.message);
      return;
    }

    setError("");
    setFeedback(result.message);
    setIsEditing(false);
  };

  const handleCardClick = (event: MouseEvent<HTMLElement>) => {
    if (isEditing) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-no-toggle='true']")) {
      return;
    }

    void onToggleBought(product.id, !product.isBought);
  };

  return (
    <article
      onClick={handleCardClick}
      className={`relative rounded-xl border p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        product.isBought
          ? "border-emerald-200 bg-emerald-50/50"
          : "border-slate-200 bg-white"
      } ${isEditing ? "" : "cursor-pointer"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3
          className={`text-base font-semibold ${
            product.isBought ? "text-slate-500 line-through" : "text-slate-900"
          }`}
        >
          {product.name}
        </h3>
        <div className="flex items-center gap-1.5">
          <button
            data-no-toggle="true"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setEditName(product.name);
              setEditSupermarkets(product.supermarkets);
              setError("");
              setFeedback("");
              setIsEditing((current) => !current);
            }}
            className="rounded-lg border border-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            data-no-toggle="true"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void onDeleteProduct(product.id);
            }}
            className="rounded-lg border border-red-200 px-2 py-0.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {!isEditing ? (
        <>
          {product.supermarkets.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {product.supermarkets.map((supermarket) => (
                <span
                  key={`${product.id}-${supermarket}`}
                  className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                >
                  {supermarket}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              No supermarket linked. Edit item to add one.
            </p>
          )}
        </>
      ) : (
        <div
          data-no-toggle="true"
          className="mt-1.5 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2"
        >
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Product name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(event) => {
                setEditName(event.target.value);
                if (error) {
                  setError("");
                }
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Supermarkets</p>
            {supermarkets.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {supermarkets.map((supermarket) => (
                  <label
                    key={`${product.id}-edit-${supermarket}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-800"
                  >
                    <input
                      type="checkbox"
                      checked={editSupermarkets.includes(supermarket)}
                      onChange={() => toggleEditSupermarket(supermarket)}
                      className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-400"
                    />
                    {supermarket}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-amber-700">
                Add supermarkets first before editing this product.
              </p>
            )}
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleSaveEdit}
            className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Save changes
          </button>
        </div>
      )}

      {feedback ? <p className="mt-1 text-sm text-emerald-700">{feedback}</p> : null}

      {product.isBought ? (
        <span className="absolute bottom-1 right-2 text-[10px] font-semibold text-emerald-700">
          {getRemainingDeleteText(product.boughtAt, nowMs)}
        </span>
      ) : null}
    </article>
  );
}

export default function ProductList({
  products,
  supermarkets,
  onDeleteProduct,
  onEditProduct,
  onToggleBought
}: ProductListProps) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  if (products.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-slate-600">
        No products found for the selected filters.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            supermarkets={supermarkets}
            nowMs={nowMs}
            onDeleteProduct={onDeleteProduct}
            onEditProduct={onEditProduct}
            onToggleBought={onToggleBought}
          />
        ))}
      </div>
    </section>
  );
}
