"use client";

import { FormEvent, useMemo, useState } from "react";
import { ActionResult, MoveDirection } from "../types";

type SupermarketManagerProps = {
  supermarkets: string[];
  sectionsBySupermarket: Record<string, string[]>;
  onAddSupermarket: (name: string) => Promise<ActionResult>;
  onEditSupermarket: (currentName: string, newName: string) => Promise<ActionResult>;
  onDeleteSupermarket: (name: string) => Promise<ActionResult>;
  onAddSection: (supermarket: string, section: string) => Promise<ActionResult>;
  onRenameSection: (
    supermarket: string,
    currentSection: string,
    newSection: string
  ) => Promise<ActionResult>;
  onMoveSection: (
    supermarket: string,
    section: string,
    direction: MoveDirection
  ) => Promise<ActionResult>;
  onDeleteSection: (supermarket: string, section: string) => Promise<ActionResult>;
};

export default function SupermarketManager({
  supermarkets,
  sectionsBySupermarket,
  onAddSupermarket,
  onEditSupermarket,
  onDeleteSupermarket,
  onAddSection,
  onRenameSection,
  onMoveSection,
  onDeleteSection
}: SupermarketManagerProps) {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [feedback, setFeedback] = useState("");
  const [sectionDraftByStore, setSectionDraftByStore] = useState<Record<string, string>>({});
  const [editingSection, setEditingSection] = useState<{ supermarket: string; current: string } | null>(null);
  const [editingSectionValue, setEditingSectionValue] = useState("");
  const [expandedStores, setExpandedStores] = useState<string[]>([]);

  const expandedSet = useMemo(() => new Set(expandedStores), [expandedStores]);

  const toggleExpanded = (supermarket: string) => {
    setExpandedStores((current) =>
      current.includes(supermarket)
        ? current.filter((item) => item !== supermarket)
        : [...current, supermarket]
    );
  };

  const handleAddSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await onAddSupermarket(name);
    setFeedback(result.message);

    if (result.success) {
      setName("");
    }
  };

  const handleSaveEdit = async () => {
    const result = await onEditSupermarket(editingName, editValue);
    setFeedback(result.message);

    if (result.success) {
      setEditingName("");
      setEditValue("");
    }
  };

  const handleDelete = async (nameToDelete: string) => {
    const confirmed = window.confirm(
      `Delete "${nameToDelete}"?\nThis also removes it from products and database templates.`
    );

    if (!confirmed) {
      return;
    }

    const result = await onDeleteSupermarket(nameToDelete);
    setFeedback(result.message);
  };

  const handleAddSection = async (supermarket: string) => {
    const draftValue = sectionDraftByStore[supermarket] ?? "";
    const result = await onAddSection(supermarket, draftValue);
    setFeedback(result.message);

    if (result.success) {
      setSectionDraftByStore((current) => ({
        ...current,
        [supermarket]: ""
      }));
      if (!expandedSet.has(supermarket)) {
        toggleExpanded(supermarket);
      }
    }
  };

  const handleMoveSection = async (
    supermarket: string,
    section: string,
    direction: MoveDirection
  ) => {
    const result = await onMoveSection(supermarket, section, direction);
    setFeedback(result.message);
  };

  const handleDeleteSection = async (supermarket: string, section: string) => {
    const confirmed = window.confirm(
      `Delete section "${section}" from ${supermarket}?\nProducts using it will be left without a section.`
    );

    if (!confirmed) {
      return;
    }

    const result = await onDeleteSection(supermarket, section);
    setFeedback(result.message);
  };

  const handleSaveSectionEdit = async () => {
    if (!editingSection) {
      return;
    }

    const result = await onRenameSection(
      editingSection.supermarket,
      editingSection.current,
      editingSectionValue
    );
    setFeedback(result.message);

    if (result.success) {
      setEditingSection(null);
      setEditingSectionValue("");
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Adicionar supermercado</h2>

        <form onSubmit={handleAddSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Aldi"
            className="h-11 w-full rounded-xl border border-slate-300 px-3 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Adicionar
          </button>
        </form>

        {feedback ? <p className="mt-2 text-sm text-slate-600">{feedback}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Supermercados</h3>

        <div className="mt-3 space-y-3">
          {supermarkets.map((supermarket) => {
            const sections = sectionsBySupermarket[supermarket] ?? [];
            const draftSection = sectionDraftByStore[supermarket] ?? "";
            const isExpanded = expandedSet.has(supermarket);

            return (
              <div key={supermarket} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                {editingName === supermarket ? (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="text"
                      value={editValue}
                      onChange={(event) => setEditValue(event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveEdit}
                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingName("");
                          setEditValue("");
                        }}
                        className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => toggleExpanded(supermarket)}
                        className="min-w-0 grow text-left"
                      >
                        <p className="font-medium text-slate-800">{supermarket}</p>
                      </button>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingName(supermarket);
                            setEditValue(supermarket);
                          }}
                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(supermarket)}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                        >
                          Apagar
                        </button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800">Secções</p>
                        </div>

                        <div className="mt-2 space-y-2">
                          {sections.length === 0 ? (
                            <p className="text-sm text-slate-500">Ainda não há secções.</p>
                          ) : (
                            sections.map((section, index) => {
                              const isEditingThisSection =
                                editingSection?.supermarket === supermarket &&
                                editingSection.current === section;

                              return (
                                <div
                                  key={`${supermarket}-${section}`}
                                  className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
                                >
                                  {isEditingThisSection ? (
                                    <div className="flex flex-col gap-2 sm:flex-row">
                                      <input
                                        type="text"
                                        value={editingSectionValue}
                                        onChange={(event) => setEditingSectionValue(event.target.value)}
                                        className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={handleSaveSectionEdit}
                                          className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                                        >
                                          Guardar
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingSection(null);
                                            setEditingSectionValue("");
                                          }}
                                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-medium text-slate-800">{section}</p>
                                        <p className="text-[11px] text-slate-500">Posição {index + 1}</p>
                                      </div>
                                      <div className="flex flex-wrap gap-2">
                                        <button
                                          type="button"
                                          onClick={() => handleMoveSection(supermarket, section, "up")}
                                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                          ↑
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleMoveSection(supermarket, section, "down")}
                                          className="rounded-lg border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                          ↓
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingSection({ supermarket, current: section });
                                            setEditingSectionValue(section);
                                          }}
                                          className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                                        >
                                          Renomear
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteSection(supermarket, section)}
                                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                                        >
                                          Apagar
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>

                        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                          <input
                            type="text"
                            value={draftSection}
                            onChange={(event) =>
                              setSectionDraftByStore((current) => ({
                                ...current,
                                [supermarket]: event.target.value
                              }))
                            }
                            placeholder="Ex.: Lacticínios"
                            className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              void handleAddSection(supermarket);
                            }}
                            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
                          >
                            Adicionar secção
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
