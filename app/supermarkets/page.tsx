"use client";

import SupermarketManager from "../../components/SupermarketManager";
import { useShopping } from "../../context/ShoppingContext";

export default function SupermarketsPage() {
  const {
    supermarkets,
    sectionsBySupermarket,
    addSupermarket,
    editSupermarket,
    deleteSupermarket,
    addSectionToSupermarket,
    renameSectionInSupermarket,
    moveSectionInSupermarket,
    deleteSectionFromSupermarket
  } = useShopping();

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-600 to-amber-500 p-4 text-white shadow-sm sm:p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-100">
          Supermercados
        </p>
        <h2 className="mt-1 text-2xl font-bold">Lojas</h2>
      </section>

      <SupermarketManager
        supermarkets={supermarkets}
        sectionsBySupermarket={sectionsBySupermarket}
        onAddSupermarket={addSupermarket}
        onEditSupermarket={editSupermarket}
        onDeleteSupermarket={deleteSupermarket}
        onAddSection={addSectionToSupermarket}
        onRenameSection={renameSectionInSupermarket}
        onMoveSection={moveSectionInSupermarket}
        onDeleteSection={deleteSectionFromSupermarket}
      />
    </div>
  );
}
