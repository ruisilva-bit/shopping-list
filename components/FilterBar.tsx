type FilterBarProps = {
  selectedSupermarket: string;
  supermarkets: string[];
  onSupermarketChange: (value: string) => void;
};

function chipClass(isActive: boolean) {
  return isActive
    ? "inline-flex h-8 items-center whitespace-nowrap rounded-full border border-slate-900 bg-slate-900 px-3.5 text-[13px] font-semibold leading-none text-white shadow-sm transition"
    : "inline-flex h-8 items-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-3.5 text-[13px] font-semibold leading-none text-slate-700 transition hover:border-slate-400 hover:bg-white";
}

export default function FilterBar({
  selectedSupermarket,
  supermarkets,
  onSupermarketChange
}: FilterBarProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
        Markets
      </p>

      <div className="flex gap-2 overflow-x-auto pb-0.5">
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

