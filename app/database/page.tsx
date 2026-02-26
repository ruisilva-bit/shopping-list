"use client";

import ProductDatabaseManager from "../../components/ProductDatabaseManager";
import { useShopping } from "../../context/ShoppingContext";

export default function ProductDatabasePage() {
  const { templates, supermarkets, editTemplate, deleteTemplate } = useShopping();

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-gradient-to-r from-cyan-700 to-blue-600 p-5 text-white shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
          Product Database
        </p>
        <h2 className="mt-1 text-2xl font-bold">Database And Buy Logs</h2>
        <p className="mt-2 text-sm text-cyan-50">
          Product defaults and buy history are updated automatically.
        </p>
      </section>

      <ProductDatabaseManager
        templates={templates}
        supermarkets={supermarkets}
        onEditTemplate={editTemplate}
        onDeleteTemplate={deleteTemplate}
      />
    </div>
  );
}
