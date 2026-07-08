"use client";

import { FormEvent, useMemo, useState } from "react";
import { ActionResult, ProductTemplate, SectionBySupermarket } from "../types";

type ProductFormProps = {
  supermarkets: string[];
  sectionsBySupermarket: Record<string, string[]>;
  templates: ProductTemplate[];
  onAddProduct: (
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  onSubmitSuccess?: () => void;
};

function equalsIgnoreCase(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function normalizeSectionMap(
  supermarkets: string[],
  sectionBySupermarket: SectionBySupermarket
): SectionBySupermarket {
  return Object.fromEntries(
    supermarkets.map((market) => [market, sectionBySupermarket[market] ?? null])
  );
}

export default function ProductForm({
  supermarkets,
  sectionsBySupermarket,
  templates,
  onAddProduct,
  onSubmitSuccess
}: ProductFormProps) {
  const [name, setName] = useState("");
  const [selectedSupermarkets, setSelectedSupermarkets] = useState<string[]>([]);
  const [selectedSections, setSelectedSections] = useState<SectionBySupermarket>({});
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const suggestions = useMemo(() => {
    const query = name.trim().toLowerCase();

    if (!query) {
      return [];
    }

    return templates
      .filter((template) => template.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [name, templates]);

  const toggleSupermarket = (supermarket: string) => {
    setSelectedSupermarkets((current) => {
      if (current.includes(supermarket)) {
        setSelectedSections((existing) => {
          const next = { ...existing };
          delete next[supermarket];
          return next;
        });
        return current.filter((item) => item !== supermarket);
      }

      return [...current, supermarket];
    });
  };

  const updateSection = (supermarket: string, section: string) => {
    setSelectedSections((current) => ({
      ...current,
      [supermarket]: section.trim() ? section : null
    }));
  };

  const applyTemplate = (template: ProductTemplate) => {
    const nextMarkets = template.supermarkets.filter((market) => supermarkets.includes(market));
    setName(template.name);
    setSelectedSupermarkets(nextMarkets);
    setSelectedSections(normalizeSectionMap(nextMarkets, template.sectionBySupermarket));
    setFeedback(`Loaded template "${template.name}".`);
    setError("");
  };

  const handleNameChange = (value: string) => {
    setName(value);
    if (error) {
      setError("");
    }
    if (feedback) {
      setFeedback("");
    }

    const exactTemplate = templates.find((template) =>
      equalsIgnoreCase(template.name, value.trim())
    );

    if (exactTemplate) {
      const nextMarkets = exactTemplate.supermarkets.filter((market) => supermarkets.includes(market));
      setSelectedSupermarkets(nextMarkets);
      setSelectedSections(normalizeSectionMap(nextMarkets, exactTemplate.sectionBySupermarket));
      setFeedback(`Loaded template "${exactTemplate.name}".`);
    }
  };

  const handleProductSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const result = await onAddProduct(
      name,
      selectedSupermarkets,
      normalizeSectionMap(selectedSupermarkets, selectedSections)
    );
    setIsSubmitting(false);

    if (!result.success) {
      setError(result.message);
      return;
    }

    setName("");
    setSelectedSupermarkets([]);
    setSelectedSections({});
    setError("");
    setFeedback(result.message);
    onSubmitSuccess?.();
  };

  return (
    <form onSubmit={handleProductSubmit} className="space-y-3">
      <p className="text-xs font-medium text-slate-500">
        Start typing to use database defaults.
      </p>

      <div className="relative">
        <label
          htmlFor="product-name"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Product
        </label>
        <input
          id="product-name"
          type="text"
          value={name}
          onChange={(event) => handleNameChange(event.target.value)}
          placeholder="Example: Milk"
          className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
        />

        {suggestions.length > 0 && name.trim().length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-52 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
            {suggestions.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="flex w-full items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm text-slate-800 transition hover:bg-slate-50 last:border-b-0"
              >
                <span className="font-medium">{template.name}</span>
                <span className="text-xs text-slate-500">
                  {template.supermarkets.length} market(s)
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-2 flex items-center justify-between text-sm font-medium text-slate-700">
          <span>Markets</span>
          <span className="text-xs text-slate-500">
            {selectedSupermarkets.length} selected
          </span>
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {supermarkets.map((supermarket) => (
            <label
              key={supermarket}
              className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 transition hover:bg-slate-100"
            >
              <input
                type="checkbox"
                checked={selectedSupermarkets.includes(supermarket)}
                onChange={() => {
                  toggleSupermarket(supermarket);
                  if (error) {
                    setError("");
                  }
                }}
                className="h-4 w-4 rounded border-slate-300 text-slate-800 focus:ring-slate-400"
              />
              {supermarket}
            </label>
          ))}
        </div>
      </fieldset>

      {selectedSupermarkets.length > 0 ? (
        <section className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">Sections by market</p>
            <span className="text-xs text-slate-500">Optional now, learn later when buying</span>
          </div>

          <div className="space-y-2">
            {selectedSupermarkets.map((supermarket) => {
              const sections = sectionsBySupermarket[supermarket] ?? [];

              return (
                <div key={`${supermarket}-section`} className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {supermarket}
                  </label>
                  <select
                    value={selectedSections[supermarket] ?? ""}
                    onChange={(event) => updateSection(supermarket, event.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">No section yet</option>
                    {sections.map((section) => (
                      <option key={`${supermarket}-${section}`} value={section}>
                        {section}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!error && feedback ? <p className="text-sm text-emerald-700">{feedback}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        {isSubmitting ? "Adding..." : "Add product"}
      </button>
    </form>
  );
}
