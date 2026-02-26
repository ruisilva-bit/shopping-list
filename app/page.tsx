"use client";

import FilterBar from "../components/FilterBar";
import ProductList from "../components/ProductList";
import { useShopping } from "../context/ShoppingContext";

export default function ProductsPage() {
  const {
    filteredProducts,
    supermarkets,
    searchTerm,
    selectedSupermarket,
    statusFilter,
    setSearchTerm,
    setSelectedSupermarket,
    setStatusFilter,
    deleteProduct,
    editProduct,
    toggleProductBought
  } = useShopping();

  return (
    <div className="space-y-2.5">
      <FilterBar
        searchTerm={searchTerm}
        selectedSupermarket={selectedSupermarket}
        statusFilter={statusFilter}
        supermarkets={supermarkets}
        onSearchChange={setSearchTerm}
        onSupermarketChange={setSelectedSupermarket}
        onStatusChange={setStatusFilter}
        onClearFilters={() => {
          setSearchTerm("");
          setSelectedSupermarket("all");
          setStatusFilter("all");
        }}
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
