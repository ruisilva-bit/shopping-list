"use client";

import FilterBar from "../components/FilterBar";
import ProductList from "../components/ProductList";
import { useShopping } from "../context/ShoppingContext";

export default function ProductsPage() {
  const {
    filteredProducts,
    supermarkets,
    selectedSupermarket,
    setSelectedSupermarket,
    deleteProduct,
    editProduct,
    toggleProductBought
  } = useShopping();

  return (
    <div className="space-y-2.5">
      <FilterBar
        selectedSupermarket={selectedSupermarket}
        supermarkets={supermarkets}
        onSupermarketChange={setSelectedSupermarket}
      />

      <ProductList
        products={filteredProducts}
        supermarkets={supermarkets}
        onDeleteProduct={deleteProduct}
        onEditProduct={editProduct}
        onToggleBought={toggleProductBought}
      />
    </div>
  );
}
