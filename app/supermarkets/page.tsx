"use client";

import SupermarketManager from "../../components/SupermarketManager";
import { useShopping } from "../../context/ShoppingContext";

export default function SupermarketsPage() {
  const { supermarkets, addSupermarket, editSupermarket, deleteSupermarket } = useShopping();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-orange-600 to-amber-500 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
          Supermarket Setup
        </p>
        <h2 className="mt-1 text-2xl font-bold">Manage Supermarkets</h2>
        <p className="mt-2 text-sm text-amber-50">
          Add, edit, or delete stores used by products and templates.
        </p>
      </section>

      <SupermarketManager
        supermarkets={supermarkets}
        onAddSupermarket={addSupermarket}
        onEditSupermarket={editSupermarket}
        onDeleteSupermarket={deleteSupermarket}
      />
    </div>
  );
}
