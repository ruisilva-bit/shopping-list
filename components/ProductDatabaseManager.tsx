"use client";

import { useMemo, useState } from "react";
import { ActionResult, ProductTemplate } from "../types";

type ProductDatabaseManagerProps = {
  templates: ProductTemplate[];
  supermarkets: string[];
  onEditTemplate: (id: string, name: string, supermarkets: string[]) => Promise<ActionResult>;
  onDeleteTemplate: (id: string) => Promise<ActionResult>;
};

const LOGS_PREVIEW_COUNT = 3;
const LOGS_PAGE_SIZE = 8;

function formatDateTime(isoDate: string) {
  try {
    return new Date(isoDate).toLocaleString();
  } catch {
    return isoDate;
  }
}

function toggleItem(items: string[], value: string) {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

export default function ProductDatabaseManager({
  templates,
  supermarkets,
  onEditTemplate,
  onDeleteTemplate
}: ProductDatabaseManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedTemplateId, setExpandedTemplateId] = useState<string | null>(null);
  const [pageByTemplate, setPageByTemplate] = useState<Record<string, number>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSupermarkets, setEditSupermarkets] = useState<string[]>([]);
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
    setFeedback("");
  };

  const saveEdit = async (templateId: string) => {
    const result = await onEditTemplate(templateId, editName, editSupermarkets);
    setFeedback(result.message);

    if (result.success) {
      setEditingTemplateId(null);
      setEditName("");
      setEditSupermarkets([]);
    }
  };

  const deleteTemplate = async (templateId: string, templateName: string) => {
    const confirmed = window.confirm(
      `Delete "${templateName}" from database?\nIt will be recreated automatically when you add the item again.`
    );

    if (!confirmed) {
      return;
    }

    const result = await onDeleteTemplate(templateId);
    setFeedback(result.message);
  };

  return (
    <div className="space-y-2.5">
      <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">Product Database</h2>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
            {templates.length} products, {totalLogs} logs
          </span>
        </div>
        <div className="mt-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search product..."
            className="h-8 w-full rounded-lg border border-slate-300 px-2.5 text-[13px] text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
        </div>
        {feedback ? <p className="mt-1 text-xs text-slate-600">{feedback}</p> : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm">
        {filteredTemplates.length === 0 ? (
          <p className="text-xs text-slate-600">
            No database entries yet.
          </p>
        ) : (
          <div className="space-y-1.5">
            {filteredTemplates.map((template) => {
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
                  className="rounded-lg border border-slate-200 bg-slate-50 p-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedTemplateId((current) =>
                          current === template.id ? null : template.id
                        )
                      }
                      className="min-w-0 grow text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {template.name}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {template.purchaseLog.length} logs
                      </p>
                    </button>

                    <div className="flex items-center gap-1">
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
                        className="rounded-md border border-slate-300 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-slate-700"
                      >
                        {isEditing ? "Cancel" : "Edit"}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          deleteTemplate(template.id, template.name);
                        }}
                        className="rounded-md border border-red-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-1.5 space-y-1.5 rounded-md border border-slate-200 bg-white p-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={(event) => setEditName(event.target.value)}
                        className="h-8 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                      />
                      <div className="flex flex-wrap gap-1">
                        {supermarkets.map((supermarket) => (
                          <button
                            key={`${template.id}-market-${supermarket}`}
                            type="button"
                            onClick={() =>
                              setEditSupermarkets((current) =>
                                toggleItem(current, supermarket)
                              )
                            }
                            className={
                              editSupermarkets.includes(supermarket)
                                ? "rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white"
                                : "rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-slate-300"
                            }
                          >
                            {supermarket}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => saveEdit(template.id)}
                        className="rounded-md bg-slate-900 px-2 py-1 text-xs font-semibold text-white"
                      >
                        Save
                      </button>
                    </div>
                  ) : null}

                  {!isEditing ? (
                    <>
                      {template.supermarkets.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {template.supermarkets.map((supermarket) => (
                            <span
                              key={`${template.id}-${supermarket}`}
                              className="rounded-full bg-white px-2 py-0.5 text-xs text-slate-700 ring-1 ring-slate-200"
                            >
                              {supermarket}
                            </span>
                          ))}
                        </div>
                      ) : null}

                      {template.purchaseLog.length > 0 ? (
                        <>
                          {isExpanded ? (
                            <div>
                              <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                                {pageLogs.map((entry, index) => (
                                  <li key={`${template.id}-${entry}-${index}`}>
                                    {pageStart + index + 1}. {formatDateTime(entry)}
                                  </li>
                                ))}
                              </ul>

                              {totalPages > 1 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
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
                                            ? "rounded-md bg-slate-900 px-1.5 py-0.5 text-xs font-semibold text-white"
                                            : "rounded-md bg-white px-1.5 py-0.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300"
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
                            <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                              {sortedLogs.slice(0, LOGS_PREVIEW_COUNT).map((entry, index) => (
                                <li key={`${template.id}-preview-${entry}-${index}`}>
                                  {formatDateTime(entry)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <p className="mt-1 text-xs text-slate-500">No buy logs yet</p>
                      )}
                    </>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
