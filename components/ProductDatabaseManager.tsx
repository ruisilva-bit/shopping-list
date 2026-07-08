"use client";

import { useMemo, useState } from "react";
import { ActionResult, ProductTemplate, SectionBySupermarket } from "../types";

type ProductDatabaseManagerProps = {
  templates: ProductTemplate[];
  supermarkets: string[];
  sectionsBySupermarket: Record<string, string[]>;
  onEditTemplate: (
    id: string,
    name: string,
    supermarkets: string[],
    sectionBySupermarket: ProductTemplate["sectionBySupermarket"]
  ) => Promise<ActionResult>;
  onDeleteTemplate: (id: string) => Promise<ActionResult>;
};

const LOGS_PREVIEW_COUNT = 3;
const LOGS_PAGE_SIZE = 8;

function formatDateTime(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleString("pt-PT");
  } catch {
    return isoDate;
  }
}

function normalizeSectionMap(
  supermarkets: string[],
  sectionBySupermarket: SectionBySupermarket
): SectionBySupermarket {
  return Object.fromEntries(
    supermarkets.map((market) => [market, sectionBySupermarket[market] ?? null])
  );
}

export default function ProductDatabaseManager({
  templates,
  supermarkets,
  sectionsBySupermarket,
  onEditTemplate,
  onDeleteTemplate
}: ProductDatabaseManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [pageByTemplate, setPageByTemplate] = useState<Record<string, number>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSupermarkets, setEditSupermarkets] = useState<string[]>([]);
  const [editSections, setEditSections] = useState<SectionBySupermarket>({});
  const [feedback, setFeedback] = useState("");

  const filteredTemplates = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    if (!query) {
      return templates;
    }

    return templates.filter((template) => template.name.toLowerCase().includes(query));
  }, [templates, searchTerm]);

  const totalLogs = useMemo(
    () => templates.reduce((sum, template) => sum + template.purchaseLog.length, 0),
    [templates]
  );

  const getCurrentPage = (templateId: string) => pageByTemplate[templateId] ?? 1;

  const setCurrentPage = (templateId: string, page: number) => {
    setPageByTemplate((current) => ({
      ...current,
      [templateId]: page
    }));
  };

  const startEdit = (template: ProductTemplate) => {
    setEditingTemplateId(template.id);
    setEditName(template.name);
    setEditSupermarkets(template.supermarkets);
    setEditSections(template.sectionBySupermarket);
    setFeedback("");
  };

  const toggleEditSupermarket = (supermarket: string) => {
    setEditSupermarkets((current) => {
      if (current.includes(supermarket)) {
        setEditSections((existing) => {
          const next = { ...existing };
          delete next[supermarket];
          return next;
        });
        return current.filter((item) => item !== supermarket);
      }

      return [...current, supermarket];
    });
  };

  const saveEdit = async (templateId: string) => {
    const result = await onEditTemplate(
      templateId,
      editName,
      editSupermarkets,
      normalizeSectionMap(editSupermarkets, editSections)
    );
    setFeedback(result.message);

    if (result.success) {
      setEditingTemplateId(null);
      setEditName("");
      setEditSupermarkets([]);
      setEditSections({});
    }
  };

  const deleteTemplate = async (templateId: string, templateName: string) => {
    const confirmed = window.confirm(
      `Apagar "${templateName}" da base de dados?\nSerá recriado automaticamente quando voltares a adicionar o item.`
    );

    if (!confirmed) {
      return;
    }

    const result = await onDeleteTemplate(templateId);
    setFeedback(result.message);
  };

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Base de dados de produtos</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {templates.length} produtos · {totalLogs} registos
          </span>
        </div>
        <div className="mt-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Pesquisar produto..."
            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        {feedback ? <p className="mt-2 text-xs text-slate-600">{feedback}</p> : null}
      </section>

      <section className="space-y-2">
        {filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500 shadow-sm">
            Nenhum produto encontrado.
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const isExpanded = expandedTemplateId === template.id;
            const isEditing = editingTemplateId === template.id;
            const sortedLogs = [...template.purchaseLog].reverse();
            const totalPages = Math.max(1, Math.ceil(sortedLogs.length / LOGS_PAGE_SIZE));
            const currentPage = Math.min(getCurrentPage(template.id), totalPages);
            const pageStart = (currentPage - 1) * LOGS_PAGE_SIZE;
            const pageLogs = sortedLogs.slice(pageStart, pageStart + LOGS_PAGE_SIZE);

            return (
              <article
                key={template.id}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedTemplateId((current) => (current === template.id ? null : template.id))
                    }
                    className="min-w-0 grow text-left"
                  >
                    <p className="truncate text-sm font-semibold text-slate-900">{template.name}</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {template.supermarkets.length > 0
                        ? template.supermarkets.join(" · ")
                        : "Sem supermercados"}
                    </p>
                  </button>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        if (isEditing) {
                          setEditingTemplateId(null);
                          return;
                        }
                        startEdit(template);
                      }}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700"
                    >
                      {isEditing ? "Cancelar" : "Editar"}
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void deleteTemplate(template.id, template.name);
                      }}
                      className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-semibold text-red-600"
                    >
                      Apagar
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-3 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nome
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Supermercados
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {supermarkets.map((supermarket) => (
                          <button
                            key={`${template.id}-market-${supermarket}`}
                            type="button"
                            onClick={() => toggleEditSupermarket(supermarket)}
                            className={
                              editSupermarkets.includes(supermarket)
                                ? "rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                                : "rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300"
                            }
                          >
                            {supermarket}
                          </button>
                        ))}
                      </div>
                    </div>

                    {editSupermarkets.length > 0 ? (
                      <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Secção por supermercado
                        </p>

                        {editSupermarkets.map((supermarket) => {
                          const suggestions = sectionsBySupermarket[supermarket] ?? [];
                          const listId = `db-section-${template.id}-${supermarket}`;

                          return (
                            <div key={`${template.id}-${supermarket}-section`} className="space-y-1">
                              <label className="block text-sm font-medium text-slate-700">
                                {supermarket}
                              </label>
                              <input
                                list={listId}
                                type="text"
                                value={editSections[supermarket] ?? ""}
                                onChange={(event) =>
                                  setEditSections((current) => ({
                                    ...current,
                                    [supermarket]: event.target.value.trim() || null
                                  }))
                                }
                                placeholder="Ex.: Lacticínios"
                                className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                              />
                              <datalist id={listId}>
                                {suggestions.map((section) => (
                                  <option key={`${listId}-${section}`} value={section} />
                                ))}
                              </datalist>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void saveEdit(template.id)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                    >
                      Guardar
                    </button>
                  </div>
                ) : null}

                {!isEditing ? (
                  <>
                    {template.supermarkets.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {template.supermarkets.map((supermarket) => {
                          const sectionName = template.sectionBySupermarket[supermarket];
                          return (
                            <span
                              key={`${template.id}-${supermarket}`}
                              className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-700"
                            >
                              {supermarket}
                              {sectionName ? ` · ${sectionName}` : ""}
                            </span>
                          );
                        })}
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Histórico de compras
                        </p>
                        <span className="text-[11px] font-semibold text-slate-500">
                          {template.purchaseLog.length} registo(s)
                        </span>
                      </div>

                      {template.purchaseLog.length > 0 ? (
                        <>
                          {isExpanded ? (
                            <div>
                              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                                {pageLogs.map((entry, index) => (
                                  <li key={`${template.id}-${entry}-${index}`}>
                                    {pageStart + index + 1}. {formatDateTime(entry)}
                                  </li>
                                ))}
                              </ul>

                              {totalPages > 1 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {Array.from({ length: totalPages }, (_, index) => index + 1).map(
                                    (page) => (
                                      <button
                                        key={`${template.id}-page-${page}`}
                                        type="button"
                                        onClick={(event) => {
                                          event.stopPropagation();
                                          setCurrentPage(template.id, page);
                                        }}
                                        className={
                                          page === currentPage
                                            ? "rounded-lg bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                                            : "rounded-lg bg-white px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-300"
                                        }
                                      >
                                        {page}
                                      </button>
                                    )
                                  )}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <ul className="mt-2 space-y-1 text-xs text-slate-700">
                              {sortedLogs.slice(0, LOGS_PREVIEW_COUNT).map((entry, index) => (
                                <li key={`${template.id}-preview-${entry}-${index}`}>
                                  {formatDateTime(entry)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Ainda sem registos de compra.</p>
                      )}
                    </div>
                  </>
                ) : null}
              </article>
            );
          })
        )}
      </section>
    </div>
  );
}
