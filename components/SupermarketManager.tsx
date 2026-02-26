"use client";

import { FormEvent, useState } from "react";
import { ActionResult } from "../types";

type SupermarketManagerProps = {
  supermarkets: string[];
  onAddSupermarket: (name: string) => ActionResult;
  onEditSupermarket: (currentName: string, newName: string) => ActionResult;
  onDeleteSupermarket: (name: string) => ActionResult;
};

export default function SupermarketManager({
  supermarkets,
  onAddSupermarket,
  onEditSupermarket,
  onDeleteSupermarket
}: SupermarketManagerProps) {
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState("");
  const [editValue, setEditValue] = useState("");
  const [feedback, setFeedback] = useState("");

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = onAddSupermarket(name);
    setFeedback(result.message);

    if (result.success) {
      setName("");
    }
  };

  const handleSaveEdit = () => {
    const result = onEditSupermarket(editingName, editValue);
    setFeedback(result.message);

    if (result.success) {
      setEditingName("");
      setEditValue("");
    }
  };

  const handleDelete = (nameToDelete: string) => {
    const confirmed = window.confirm(
      `Delete "${nameToDelete}"?\nThis also removes it from products and database templates.`
    );

    if (!confirmed) {
      return;
    }

    const result = onDeleteSupermarket(nameToDelete);
    setFeedback(result.message);
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md">
        <h2 className="text-lg font-semibold text-slate-900">Add Supermarket</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create options for products and template defaults.
        </p>

        <form onSubmit={handleAddSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Example: Aldi"
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
          />
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            Add
          </button>
        </form>

        {feedback ? <p className="mt-2 text-sm text-slate-600">{feedback}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Edit Or Delete Supermarkets</h3>
        <p className="mt-1 text-sm text-slate-600">
          Deleting a supermarket removes it from items and templates.
        </p>

        <div className="mt-3 space-y-2">
          {supermarkets.map((supermarket) => (
            <div
              key={supermarket}
              className="rounded-xl border border-slate-200 bg-slate-50 p-3"
            >
              {editingName === supermarket ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(event) => setEditValue(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSaveEdit}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName("");
                        setEditValue("");
                      }}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-slate-800">{supermarket}</p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingName(supermarket);
                        setEditValue(supermarket);
                      }}
                      className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(supermarket)}
                      className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
