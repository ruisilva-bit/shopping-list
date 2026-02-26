"use client";

import { useEffect } from "react";
import ProductForm from "./ProductForm";
import { useShopping } from "../context/ShoppingContext";

export default function AddProductModal() {
  const {
    isAddModalOpen,
    closeAddModal,
    supermarkets,
    templates,
    addProduct
  } = useShopping();

  useEffect(() => {
    if (!isAddModalOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeAddModal();
      }
    };

    window.addEventListener("keydown", onEscape);
    return () => {
      window.removeEventListener("keydown", onEscape);
    };
  }, [isAddModalOpen, closeAddModal]);

  if (!isAddModalOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/40 p-3 sm:items-center sm:p-4">
      <button
        type="button"
        aria-label="Close add product modal"
        onClick={closeAddModal}
        className="absolute inset-0"
      />

      <section className="relative z-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-xl sm:p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Add Product</h2>
            <p className="text-sm text-slate-600">Quick add from menu.</p>
          </div>
          <button
            type="button"
            onClick={closeAddModal}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>
        </div>

        <ProductForm
          supermarkets={supermarkets}
          templates={templates}
          onAddProduct={addProduct}
          onSubmitSuccess={closeAddModal}
        />
      </section>
    </div>
  );
}
