"use client";

import { MouseEvent, PointerEvent, useEffect, useMemo, useRef, useState } from "react";
import { ActionResult, Product, PurchaseContext, SectionBySupermarket } from "../types";

type ProductListProps = {
  products: Product[];
  supermarkets: string[];
  sectionsBySupermarket: Record<string, string[]>;
  selectedSupermarket: string;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (
    id: string,
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  onToggleBought: (id: string, isBought: boolean, context?: PurchaseContext) => Promise<void>;
};

type ProductCardProps = {
  product: Product;
  supermarkets: string[];
  sectionsBySupermarket: Record<string, string[]>;
  nowMs: number;
  onDeleteProduct: (id: string) => Promise<void>;
  onEditProduct: (
    id: string,
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  onToggleBoughtIntent: (product: Product) => void;
};

type PurchasePromptState = {
  product: Product;
  supermarket: string | null;
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

function normalizeSectionMap(
  supermarkets: string[],
  sectionBySupermarket: SectionBySupermarket
): SectionBySupermarket {
  return Object.fromEntries(
    supermarkets.map((market) => [market, sectionBySupermarket[market] ?? null])
  );
}

function ProductCard({
  product,
  supermarkets,
  sectionsBySupermarket,
  nowMs,
  onDeleteProduct,
  onEditProduct,
  onToggleBoughtIntent
}: ProductCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(product.name);
  const [editSupermarkets, setEditSupermarkets] = useState<string[]>(product.supermarkets);
  const [editSections, setEditSections] = useState<SectionBySupermarket>(product.sectionBySupermarket);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const pointerStartXRef = useRef<number | null>(null);
  const pointerStartYRef = useRef<number | null>(null);
  const dragXRef = useRef(0);
  const suppressClickRef = useRef(false);

  const toggleEditSupermarket = (market: string) => {
    setEditSupermarkets((current) => {
      if (current.includes(market)) {
        setEditSections((existing) => {
          const next = { ...existing };
          delete next[market];
          return next;
        });
        return current.filter((item) => item !== market);
      }

      return [...current, market];
    });
  };

  const openEdit = () => {
    setEditName(product.name);
    setEditSupermarkets(product.supermarkets);
    setEditSections(product.sectionBySupermarket);
    setError("");
    setFeedback("");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const result = await onEditProduct(
      product.id,
      editName,
      editSupermarkets,
      normalizeSectionMap(editSupermarkets, editSections)
    );
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

    onToggleBoughtIntent(product);
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
        } ${isEditing ? "" : "cursor-pointer select-none"}`}
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
                {product.supermarkets.map((supermarket) => {
                  const sectionName = product.sectionBySupermarket[supermarket];

                  return (
                    <span
                      key={`${product.id}-${supermarket}`}
                      className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                    >
                      {supermarket}
                      {sectionName ? ` • ${sectionName}` : ""}
                    </span>
                  );
                })}
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

            {editSupermarkets.length > 0 ? (
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2">
                <p className="text-sm font-medium text-slate-700">Sections by market</p>
                {editSupermarkets.map((supermarket) => {
                  const availableSections = sectionsBySupermarket[supermarket] ?? [];

                  return (
                    <div key={`${product.id}-${supermarket}-section`} className="space-y-1">
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {supermarket}
                      </label>
                      <select
                        value={editSections[supermarket] ?? ""}
                        onChange={(event) =>
                          setEditSections((current) => ({
                            ...current,
                            [supermarket]: event.target.value || null
                          }))
                        }
                        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      >
                        <option value="">No section yet</option>
                        {availableSections.map((section) => (
                          <option key={`${supermarket}-${section}`} value={section}>
                            {section}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ) : null}

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
  sectionsBySupermarket,
  selectedSupermarket,
  onDeleteProduct,
  onEditProduct,
  onToggleBought
}: ProductListProps) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [purchasePrompt, setPurchasePrompt] = useState<PurchasePromptState | null>(null);
  const [promptSupermarket, setPromptSupermarket] = useState("");
  const [promptSection, setPromptSection] = useState("");
  const [customSection, setCustomSection] = useState("");
  const [isSubmittingPrompt, setIsSubmittingPrompt] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  const groupedProducts = useMemo(() => {
    if (selectedSupermarket === "all") {
      return null;
    }

    const orderedSections = sectionsBySupermarket[selectedSupermarket] ?? [];
    const sectionIndex = new Map(orderedSections.map((section, index) => [section, index]));
    const sorted = [...products].sort((a, b) => {
      const aSection = a.sectionBySupermarket[selectedSupermarket] ?? "";
      const bSection = b.sectionBySupermarket[selectedSupermarket] ?? "";
      const aIndex = aSection ? (sectionIndex.get(aSection) ?? orderedSections.length + 1) : orderedSections.length;
      const bIndex = bSection ? (sectionIndex.get(bSection) ?? orderedSections.length + 1) : orderedSections.length;

      if (a.isBought !== b.isBought) {
        return a.isBought ? 1 : -1;
      }
      if (aIndex !== bIndex) {
        return aIndex - bIndex;
      }
      if (aSection !== bSection) {
        return aSection.localeCompare(bSection);
      }
      return a.name.localeCompare(b.name);
    });

    const groups = new Map<string, Product[]>();
    sorted.forEach((product) => {
      const sectionName = product.sectionBySupermarket[selectedSupermarket] ?? "__unassigned__";
      const existing = groups.get(sectionName) ?? [];
      existing.push(product);
      groups.set(sectionName, existing);
    });

    return Array.from(groups.entries()).map(([sectionName, groupProducts]) => ({
      sectionName,
      products: groupProducts
    }));
  }, [products, sectionsBySupermarket, selectedSupermarket]);

  const resetPrompt = () => {
    setPurchasePrompt(null);
    setPromptSupermarket("");
    setPromptSection("");
    setCustomSection("");
    setIsSubmittingPrompt(false);
  };

  const openPrompt = (product: Product, supermarket: string | null) => {
    setPurchasePrompt({ product, supermarket });
    setPromptSupermarket(supermarket ?? "");
    setPromptSection(supermarket ? product.sectionBySupermarket[supermarket] ?? "" : "");
    setCustomSection("");
  };

  const handleToggleBoughtIntent = (product: Product) => {
    if (product.isBought) {
      void onToggleBought(product.id, false);
      return;
    }

    const inferredSupermarket =
      selectedSupermarket !== "all" && product.supermarkets.includes(selectedSupermarket)
        ? selectedSupermarket
        : product.supermarkets.length === 1
          ? product.supermarkets[0]
          : null;

    if (inferredSupermarket) {
      const existingSection = product.sectionBySupermarket[inferredSupermarket];
      if (existingSection) {
        void onToggleBought(product.id, true, {
          supermarket: inferredSupermarket,
          sectionName: existingSection
        });
        return;
      }
    }

    openPrompt(product, inferredSupermarket);
  };

  const handleSubmitPrompt = async () => {
    if (!purchasePrompt) {
      return;
    }

    const fallbackMarket = purchasePrompt.supermarket ?? purchasePrompt.product.supermarkets[0] ?? "";
    const resolvedSupermarket = (promptSupermarket || fallbackMarket).trim();
    if (!resolvedSupermarket) {
      return;
    }

    const resolvedSection = customSection.trim() || promptSection.trim() || null;

    setIsSubmittingPrompt(true);
    await onToggleBought(purchasePrompt.product.id, true, {
      supermarket: resolvedSupermarket,
      sectionName: resolvedSection
    });
    resetPrompt();
  };

  if (products.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-slate-600">
        No products found for the selected market.
      </section>
    );
  }

  return (
    <>
      <section className="space-y-3">
        {groupedProducts ? (
          groupedProducts.map((group) => (
            <div key={group.sectionName} className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2">
                <h3 className="text-sm font-semibold text-slate-800">
                  {group.sectionName === "__unassigned__" ? "Sem secção" : group.sectionName}
                </h3>
                <span className="text-xs text-slate-500">{group.products.length}</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {group.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    supermarkets={supermarkets}
                    sectionsBySupermarket={sectionsBySupermarket}
                    nowMs={nowMs}
                    onDeleteProduct={onDeleteProduct}
                    onEditProduct={onEditProduct}
                    onToggleBoughtIntent={handleToggleBoughtIntent}
                  />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                supermarkets={supermarkets}
                sectionsBySupermarket={sectionsBySupermarket}
                nowMs={nowMs}
                onDeleteProduct={onDeleteProduct}
                onEditProduct={onEditProduct}
                onToggleBoughtIntent={handleToggleBoughtIntent}
              />
            ))}
          </div>
        )}
      </section>

      {purchasePrompt ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-4">
          <button
            type="button"
            aria-label="Close buy prompt"
            onClick={resetPrompt}
            className="absolute inset-0"
          />

          <section className="relative z-10 w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-600">
                Learn while buying
              </p>
              <h2 className="mt-1 text-lg font-semibold text-slate-900">Onde encontraste isto?</h2>
              <p className="mt-1 text-sm text-slate-600">{purchasePrompt.product.name}</p>
            </div>

            <div className="mt-4 space-y-3" data-no-toggle="true">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Supermercado</label>
                <select
                  value={promptSupermarket}
                  onChange={(event) => {
                    const nextMarket = event.target.value;
                    setPromptSupermarket(nextMarket);
                    setPromptSection(
                      nextMarket ? purchasePrompt.product.sectionBySupermarket[nextMarket] ?? "" : ""
                    );
                    setCustomSection("");
                  }}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                >
                  <option value="">Escolhe uma loja</option>
                  {purchasePrompt.product.supermarkets.map((market) => (
                    <option key={`${purchasePrompt.product.id}-${market}`} value={market}>
                      {market}
                    </option>
                  ))}
                </select>
              </div>

              {promptSupermarket ? (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Secção</label>
                    <select
                      value={promptSection}
                      onChange={(event) => setPromptSection(event.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="">Sem secção / agora não</option>
                      {(sectionsBySupermarket[promptSupermarket] ?? []).map((section) => (
                        <option key={`${promptSupermarket}-${section}`} value={section}>
                          {section}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">Ou cria nova secção</label>
                    <input
                      type="text"
                      value={customSection}
                      onChange={(event) => setCustomSection(event.target.value)}
                      placeholder="Ex.: Lacticínios"
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                  </div>
                </>
              ) : null}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={resetPrompt}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!promptSupermarket || isSubmittingPrompt}
                onClick={() => {
                  void handleSubmitPrompt();
                }}
                className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmittingPrompt ? "A guardar..." : "Marcar como comprado"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
