import { useMemo, useState } from "react";

type FilterBarProps = {
  selectedSupermarket: string;
  supermarkets: string[];
  onSupermarketChange: (value: string) => void;
};

const COLLAPSED_MARKETS_COUNT = 5;

function chipClass(isActive: boolean) {
  return isActive
    ? "inline-flex h-7 items-center whitespace-nowrap rounded-full border border-slate-900 bg-slate-900 px-2.5 text-xs font-semibold leading-none text-white shadow-sm transition"
    : "inline-flex h-7 items-center whitespace-nowrap rounded-full border border-slate-300 bg-slate-50 px-2.5 text-xs font-semibold leading-none text-slate-700 transition hover:border-slate-400 hover:bg-white";
}

export default function FilterBar({
  selectedSupermarket,
  supermarkets,
  onSupermarketChange
}: FilterBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleSupermarkets = useMemo(() => {
    if (supermarkets.length <= COLLAPSED_MARKETS_COUNT || isExpanded) {
      return supermarkets;
    }

    const base = supermarkets.slice(0, COLLAPSED_MARKETS_COUNT);

    if (
      selectedSupermarket !== "all" &&
      supermarkets.includes(selectedSupermarket) &&
      !base.includes(selectedSupermarket)
    ) {
      return [...base.slice(0, COLLAPSED_MARKETS_COUNT - 1), selectedSupermarket];
    }

    return base;
  }, [isExpanded, selectedSupermarket, supermarkets]);

  const hiddenCount = supermarkets.length - visibleSupermarkets.length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          Markets
        </p>
        {supermarkets.length > COLLAPSED_MARKETS_COUNT ? (
          <button
            type="button"
            onClick={() => setIsExpanded((current) => !current)}
            className="rounded-md border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            {isExpanded ? "Less" : `+${hiddenCount}`}
          </button>
        ) : null}
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => onSupermarketChange("all")}
          className={chipClass(selectedSupermarket === "all")}
        >
          All
        </button>
        {visibleSupermarkets.map((supermarket) => (
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
