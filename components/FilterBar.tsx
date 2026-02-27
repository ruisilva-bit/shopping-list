type FilterBarProps = {
  selectedSupermarket: string;
  supermarkets: string[];
  onSupermarketChange: (value: string) => void;
};

function chipClass(isActive: boolean) {
  return isActive
    ? "rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white"
    : "rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100";
}

export default function FilterBar({
  selectedSupermarket,
  supermarkets,
  onSupermarketChange
}: FilterBarProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Markets
      </p>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onSupermarketChange("all")}
          className={chipClass(selectedSupermarket === "all")}
        >
          All
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

