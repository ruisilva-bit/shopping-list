"use client";

import ProductDatabaseManager from "../../components/ProductDatabaseManager";
import { useShopping } from "../../context/ShoppingContext";

export default function ProductDatabasePage() {
  const { templates, supermarkets, sectionsBySupermarket, editTemplate, deleteTemplate } =
    useShopping();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-700 to-blue-600 p-4 text-white shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
          Base de dados
        </p>
        <h2 className="mt-1 text-2xl font-bold">Produtos e histórico</h2>
        <p className="mt-2 text-sm text-cyan-50">
          Edita nome, supermercados e secção por supermercado de cada produto guardado.
        </p>
      </section>

      <ProductDatabaseManager
        templates={templates}
        supermarkets={supermarkets}
        sectionsBySupermarket={sectionsBySupermarket}
        onEditTemplate={editTemplate}
        onDeleteTemplate={deleteTemplate}
      />
    </div>
  );
}
