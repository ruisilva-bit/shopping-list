"use client";

import { MouseEvent, PointerEvent, useEffect, useRef, useState } from "react";
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
const SWIPE_TRIGGER = 72;
const SWIPE_MAX = 96;

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
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const suppressClickRef = useRef(false);

  const toggleEditSupermarket = (market: string) => {
    setEditSupermarkets((current) =>
      current.includes(market)
        ? current.filter((item) => item !== market)
        : [...current, market]
    );
  };

  const openEdit = () => {
    setEditName(product.name);
    setEditSupermarkets(product.supermarkets);
    setError("");
    setFeedback("");
    setIsEditing(true);
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

    if (suppressClickRef.current || Math.abs(dragXRef.current) > 5) {
      suppressClickRef.current = false;
      dragXRef.current = 0;
      return;
    }

    void onToggleBought(product.id, !product.isBought);
  };

  const resetSwipe = () => {
    setIsDragging(false);
    setDragX(0);
    dragXRef.current = 0;
    pointerStartXRef.current = null;
    pointerStartYRef.current = null;
  };

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    if (isEditing) {
      return;
    }

    if (event.pointerType === "mouse" && event.button !== 0) {
      return;
    }

    const target = event.target as HTMLElement;
    if (target.closest("[data-no-toggle='true']")) {
      return;
    }

    pointerStartXRef.current = event.clientX;
    pointerStartYRef.current = event.clientY;
    suppressClickRef.current = false;
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!isDragging || pointerStartXRef.current === null || pointerStartYRef.current === null) {
      return;
    }

    const deltaX = event.clientX - pointerStartXRef.current;
    const deltaY = event.clientY - pointerStartYRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      return;
    }

    if (Math.abs(deltaX) <= 6) {
      return;
    }

    suppressClickRef.current = true;
    const clamped = Math.max(-SWIPE_MAX, Math.min(SWIPE_MAX, deltaX));
    dragXRef.current = clamped;
    setDragX(clamped);
  };

  const handlePointerUp = async () => {
    if (!isDragging) {
      return;
    }

    const finalDelta = dragXRef.current;
    resetSwipe();

    if (finalDelta <= -SWIPE_TRIGGER) {
      openEdit();
    } else if (finalDelta >= SWIPE_TRIGGER) {
      const confirmed = window.confirm(`Delete "${product.name}"?`);
      if (confirmed) {
        await onDeleteProduct(product.id);
      }
    }

    window.setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  };

  const handlePointerCancel = () => {
    resetSwipe();
    suppressClickRef.current = false;
  };

  return (
    <div className="relative overflow-hidden rounded-xl">
      <div
        className="absolute inset-y-0 left-0 flex w-24 items-center pl-3 text-xs font-semibold text-red-600"
        style={{ opacity: dragX > 8 ? Math.min(1, dragX / 48) : 0 }}
      >
        Delete
      </div>
      <div
        className="absolute inset-y-0 right-0 flex w-24 items-center justify-end pr-3 text-xs font-semibold text-slate-700"
        style={{ opacity: dragX < -8 ? Math.min(1, -dragX / 48) : 0 }}
      >
        Edit
      </div>

      <article
        onClick={handleCardClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          void handlePointerUp();
        }}
        onPointerCancel={handlePointerCancel}
        style={{
          transform: `translateX(${dragX}px)`,
          transition: isDragging ? "none" : "transform 180ms ease"
        }}
        className={`relative touch-pan-y rounded-xl border p-2 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
          product.isBought
            ? "border-emerald-200 bg-emerald-50/50"
            : "border-slate-200 bg-white"
        } ${isEditing ? "" : "cursor-pointer"}`}
      >
        {!isEditing ? (
          <>
            <div className="flex items-start justify-between gap-2">
              <h3
                className={`text-base font-semibold ${
                  product.isBought ? "text-slate-500 line-through" : "text-slate-900"
                }`}
              >
                {product.name}
              </h3>
              {product.isBought ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  Bought
                </span>
              ) : null}
            </div>

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
              <p className="mt-1 text-xs text-amber-700">No supermarket linked.</p>
            )}

          </>
        ) : (
          <div
            data-no-toggle="true"
            className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-2"
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

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveEdit}
                className="rounded-xl bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError("");
                }}
                className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {feedback ? <p className="mt-1 text-sm text-emerald-700">{feedback}</p> : null}

        {product.isBought ? (
          <span className="absolute bottom-1 right-2 text-[10px] font-semibold text-emerald-700">
            {getRemainingDeleteText(product.boughtAt, nowMs)}
          </span>
        ) : null}
      </article>
    </div>
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
        No products found for the selected market.
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

