import { ProductStatusFilter } from "../context/ShoppingContext";

type FilterBarProps = {
  searchTerm: string;
  selectedSupermarket: string;
  statusFilter: ProductStatusFilter;
  supermarkets: string[];
  onSearchChange: (value: string) => void;
  onSupermarketChange: (value: string) => void;
  onStatusChange: (value: ProductStatusFilter) => void;
  onClearFilters: () => void;
};

function chipClass(isActive: boolean) {
  return isActive
    ? "rounded-full bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white transition"
    : "rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100";
}

export default function FilterBar({
  searchTerm,
  selectedSupermarket,
  statusFilter,
  supermarkets,
  onSearchChange,
  onSupermarketChange,
  onStatusChange,
  onClearFilters
}: FilterBarProps) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white/95 p-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
          Quick Filters
        </h2>
        <button
          type="button"
          onClick={onClearFilters}
          className="rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-300 transition hover:bg-slate-100"
        >
          Reset
        </button>
      </div>

      <div className="mt-2">
        <input
          id="search"
          type="text"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search..."
          className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Status:
        </span>
        <button
          type="button"
          onClick={() => onStatusChange("all")}
          className={chipClass(statusFilter === "all")}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("active")}
          className={chipClass(statusFilter === "active")}
        >
          To buy
        </button>
        <button
          type="button"
          onClick={() => onStatusChange("bought")}
          className={chipClass(statusFilter === "bought")}
        >
          Bought
        </button>
      </div>

      <div className="mt-1.5 flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onSupermarketChange("all")}
          className={chipClass(selectedSupermarket === "all")}
        >
          All markets
        </button>
        {supermarkets.map((supermarket) => (
          <button
            key={supermarket}
            type="button"
            onClick={() => onSupermarketChange(supermarket)}
            className={chipClass(selectedSupermarket === supermarket)}
          >
            {supermarket}
          </button>
        ))}
      </div>
    </section>
  );
}
