"use client";

import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { ActionResult, Product, ProductTemplate } from "../types";

const DEFAULT_SUPERMARKETS = ["Continente", "Pingo Doce", "Lidl", "Mercadona"];
const PRODUCTS_STORAGE_KEY = "shopping-list-products";
const SUPERMARKETS_STORAGE_KEY = "shopping-list-supermarkets";
const TEMPLATES_STORAGE_KEY = "shopping-list-product-templates";
const ONE_HOUR_MS = 60 * 60 * 1000;

export type ProductStatusFilter = "all" | "active" | "bought";

type ShoppingContextValue = {
  products: Product[];
  supermarkets: string[];
  templates: ProductTemplate[];
  filteredProducts: Product[];
  searchTerm: string;
  selectedSupermarket: string;
  statusFilter: ProductStatusFilter;
  isAddModalOpen: boolean;
  setSearchTerm: (value: string) => void;
  setSelectedSupermarket: (value: string) => void;
  setStatusFilter: (value: ProductStatusFilter) => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  addProduct: (name: string, supermarkets: string[]) => ActionResult;
  editProduct: (id: string, name: string, supermarkets: string[]) => ActionResult;
  deleteProduct: (id: string) => void;
  toggleProductBought: (id: string, isBought: boolean) => void;
  addSupermarket: (name: string) => ActionResult;
  editSupermarket: (currentName: string, newName: string) => ActionResult;
  deleteSupermarket: (name: string) => ActionResult;
  editTemplate: (id: string, name: string, supermarkets: string[]) => ActionResult;
  deleteTemplate: (id: string) => ActionResult;
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeMarkets(supermarkets: string[]) {
  return Array.from(
    new Set(
      supermarkets
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
    )
  );
}

function sanitizeName(name: string) {
  return name.trim();
}

function equalsIgnoreCase(a: string, b: string) {
  return a.toLowerCase() === b.toLowerCase();
}

function isExpiredBoughtProduct(product: Product, nowMs: number) {
  if (!product.isBought || !product.boughtAt) {
    return false;
  }

  const boughtAtMs = Date.parse(product.boughtAt);

  if (Number.isNaN(boughtAtMs)) {
    return false;
  }

  return nowMs - boughtAtMs >= ONE_HOUR_MS;
}

function pruneExpiredProducts(products: Product[]) {
  const nowMs = Date.now();
  return products.filter((product) => !isExpiredBoughtProduct(product, nowMs));
}

function normalizeProduct(value: unknown): Product | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? sanitizeName(item.name) : "";
  const rawSupermarkets = Array.isArray(item.supermarkets)
    ? item.supermarkets.filter((market): market is string => typeof market === "string")
    : [];
  const isBought = typeof item.isBought === "boolean" ? item.isBought : false;
  const boughtAt = typeof item.boughtAt === "string" ? item.boughtAt : null;

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    supermarkets: normalizeMarkets(rawSupermarkets),
    isBought,
    boughtAt: isBought ? boughtAt : null
  };
}

function normalizeTemplate(value: unknown): ProductTemplate | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const item = value as Record<string, unknown>;
  const id = typeof item.id === "string" ? item.id : "";
  const name = typeof item.name === "string" ? sanitizeName(item.name) : "";
  const rawSupermarkets = Array.isArray(item.supermarkets)
    ? item.supermarkets.filter((market): market is string => typeof market === "string")
    : [];
  const purchaseLog = Array.isArray(item.purchaseLog)
    ? item.purchaseLog.filter((log): log is string => typeof log === "string")
    : [];

  if (!id || !name) {
    return null;
  }

  return {
    id,
    name,
    supermarkets: normalizeMarkets(rawSupermarkets),
    purchaseLog
  };
}

function mergeAndDedupeTemplates(templates: ProductTemplate[]) {
  return templates.reduce<ProductTemplate[]>((accumulator, template) => {
    const existingIndex = accumulator.findIndex((item) =>
      equalsIgnoreCase(item.name, template.name)
    );

    if (existingIndex === -1) {
      accumulator.push({
        ...template,
        supermarkets: normalizeMarkets(template.supermarkets),
        purchaseLog: [...template.purchaseLog]
      });
      return accumulator;
    }

    const existing = accumulator[existingIndex];
    accumulator[existingIndex] = {
      ...existing,
      supermarkets: normalizeMarkets([...existing.supermarkets, ...template.supermarkets]),
      purchaseLog: [...existing.purchaseLog, ...template.purchaseLog]
    };

    return accumulator;
  }, []);
}

function upsertTemplateMarkets(
  templates: ProductTemplate[],
  productName: string,
  productMarkets: string[]
) {
  const existingIndex = templates.findIndex((template) =>
    equalsIgnoreCase(template.name, productName)
  );

  if (existingIndex === -1) {
    return [
      {
        id: createId(),
        name: productName,
        supermarkets: productMarkets,
        purchaseLog: []
      },
      ...templates
    ];
  }

  return templates.map((template, index) =>
    index === existingIndex
      ? {
          ...template,
          name: productName,
          supermarkets: productMarkets
        }
      : template
  );
}

function appendTemplateLog(
  templates: ProductTemplate[],
  productName: string,
  productMarkets: string[],
  boughtTimestamp: string
) {
  const existingIndex = templates.findIndex((template) =>
    equalsIgnoreCase(template.name, productName)
  );

  if (existingIndex === -1) {
    return [
      {
        id: createId(),
        name: productName,
        supermarkets: productMarkets,
        purchaseLog: [boughtTimestamp]
      },
      ...templates
    ];
  }

  return templates.map((template, index) =>
    index === existingIndex
      ? {
          ...template,
          name: productName,
          supermarkets:
            productMarkets.length > 0 ? productMarkets : template.supermarkets,
          purchaseLog: [...template.purchaseLog, boughtTimestamp]
        }
      : template
  );
}

type ShoppingProviderProps = {
  children: ReactNode;
};

export function ShoppingProvider({ children }: ShoppingProviderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [supermarkets, setSupermarkets] = useState<string[]>(DEFAULT_SUPERMARKETS);
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupermarket, setSelectedSupermarket] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);

  useEffect(() => {
    // Hydrate state from localStorage once at app startup.
    try {
      const storedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      const storedSupermarkets = localStorage.getItem(SUPERMARKETS_STORAGE_KEY);
      const storedTemplates = localStorage.getItem(TEMPLATES_STORAGE_KEY);

      let safeProducts: Product[] = [];
      let safeTemplates: ProductTemplate[] = [];

      if (storedProducts) {
        const parsedProducts: unknown = JSON.parse(storedProducts);
        if (Array.isArray(parsedProducts)) {
          safeProducts = parsedProducts
            .map((item) => normalizeProduct(item))
            .filter((item): item is Product => item !== null);
        }
      }

      const prunedProducts = pruneExpiredProducts(safeProducts);
      setProducts(prunedProducts);

      if (storedSupermarkets) {
        const parsedSupermarkets: unknown = JSON.parse(storedSupermarkets);
        if (Array.isArray(parsedSupermarkets)) {
          const safeSupermarkets = normalizeMarkets(
            parsedSupermarkets.filter((item): item is string => typeof item === "string")
          );

          if (safeSupermarkets.length > 0) {
            setSupermarkets(safeSupermarkets);
          }
        }
      }

      if (storedTemplates) {
        const parsedTemplates: unknown = JSON.parse(storedTemplates);
        if (Array.isArray(parsedTemplates)) {
          safeTemplates = parsedTemplates
            .map((item) => normalizeTemplate(item))
            .filter((item): item is ProductTemplate => item !== null);
        }
      }

      // Ensure database entries exist for products even if templates were empty.
      const mergedTemplates = prunedProducts.reduce(
        (currentTemplates, product) =>
          upsertTemplateMarkets(currentTemplates, product.name, product.supermarkets),
        mergeAndDedupeTemplates(safeTemplates)
      );

      setTemplates(mergedTemplates);
    } catch {
      // Keep safe defaults when stored data is malformed.
    } finally {
      setHasLoadedStorage(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
  }, [products, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    localStorage.setItem(SUPERMARKETS_STORAGE_KEY, JSON.stringify(supermarkets));
  }, [supermarkets, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  }, [templates, hasLoadedStorage]);

  useEffect(() => {
    if (!hasLoadedStorage) {
      return;
    }

    const pruneNow = () => {
      setProducts((current) => {
        const pruned = pruneExpiredProducts(current);
        return pruned.length === current.length ? current : pruned;
      });
    };

    pruneNow();
    const intervalId = window.setInterval(pruneNow, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [hasLoadedStorage]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const matches = products.filter((product) => {
      const matchesName = product.name.toLowerCase().includes(normalizedSearch);
      const matchesSupermarket =
        selectedSupermarket === "all" ||
        product.supermarkets.includes(selectedSupermarket);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? !product.isBought : product.isBought);

      return matchesName && matchesSupermarket && matchesStatus;
    });

    // Keep not-bought items first for faster shopping flow.
    return matches.sort((a, b) => {
      if (a.isBought === b.isBought) {
        return 0;
      }

      return a.isBought ? 1 : -1;
    });
  }, [products, searchTerm, selectedSupermarket, statusFilter]);

  const addProduct = (name: string, selectedMarkets: string[]): ActionResult => {
    const normalizedName = sanitizeName(name);
    const normalizedMarkets = normalizeMarkets(selectedMarkets);

    if (!normalizedName) {
      return { success: false, message: "Please enter a product name." };
    }

    if (normalizedMarkets.length === 0) {
      return { success: false, message: "Select at least one supermarket." };
    }

    const newProduct: Product = {
      id: createId(),
      name: normalizedName,
      supermarkets: normalizedMarkets,
      isBought: false,
      boughtAt: null
    };

    setProducts((current) => [newProduct, ...current]);
    setTemplates((current) =>
      upsertTemplateMarkets(current, normalizedName, normalizedMarkets)
    );

    return { success: true, message: `Added "${normalizedName}".` };
  };

  const editProduct = (id: string, name: string, selectedMarkets: string[]): ActionResult => {
    const normalizedName = sanitizeName(name);
    const normalizedMarkets = normalizeMarkets(selectedMarkets);

    if (!normalizedName) {
      return { success: false, message: "Please enter a product name." };
    }

    if (normalizedMarkets.length === 0) {
      return { success: false, message: "Select at least one supermarket." };
    }

    setProducts((current) =>
      current.map((product) =>
        product.id === id
          ? {
              ...product,
              name: normalizedName,
              supermarkets: normalizedMarkets
            }
          : product
      )
    );

    setTemplates((current) =>
      upsertTemplateMarkets(current, normalizedName, normalizedMarkets)
    );

    return { success: true, message: "Product updated." };
  };

  const deleteProduct = (id: string) => {
    setProducts((current) => current.filter((product) => product.id !== id));
  };

  const toggleProductBought = (id: string, isBought: boolean) => {
    const boughtTimestamp = new Date().toISOString();
    let boughtProductName = "";
    let boughtProductMarkets: string[] = [];

    setProducts((current) =>
      current.map((product) => {
        if (product.id !== id) {
          return product;
        }

        if (isBought && !product.isBought) {
          boughtProductName = product.name;
          boughtProductMarkets = product.supermarkets;

          return {
            ...product,
            isBought: true,
            boughtAt: boughtTimestamp
          };
        }

        if (!isBought && product.isBought) {
          return {
            ...product,
            isBought: false,
            boughtAt: null
          };
        }

        return product;
      })
    );

    if (isBought && boughtProductName) {
      setTemplates((current) =>
        appendTemplateLog(
          current,
          boughtProductName,
          boughtProductMarkets,
          boughtTimestamp
        )
      );
    }
  };

  const addSupermarket = (name: string): ActionResult => {
    const normalizedName = sanitizeName(name);

    if (!normalizedName) {
      return { success: false, message: "Please enter a supermarket name." };
    }

    const alreadyExists = supermarkets.some((supermarket) =>
      equalsIgnoreCase(supermarket, normalizedName)
    );

    if (alreadyExists) {
      return { success: false, message: "That supermarket already exists." };
    }

    setSupermarkets((current) => [...current, normalizedName]);
    return { success: true, message: "Supermarket added successfully." };
  };

  const editSupermarket = (currentName: string, newName: string): ActionResult => {
    const normalizedNewName = sanitizeName(newName);
    const existingName = supermarkets.find((item) => equalsIgnoreCase(item, currentName));

    if (!existingName) {
      return { success: false, message: "Supermarket not found." };
    }

    if (!normalizedNewName) {
      return { success: false, message: "Please enter a supermarket name." };
    }

    const hasConflict = supermarkets.some(
      (item) => !equalsIgnoreCase(item, existingName) && equalsIgnoreCase(item, normalizedNewName)
    );

    if (hasConflict) {
      return { success: false, message: "Another supermarket already has that name." };
    }

    setSupermarkets((current) =>
      current.map((item) => (equalsIgnoreCase(item, existingName) ? normalizedNewName : item))
    );

    setProducts((current) =>
      current.map((product) => ({
        ...product,
        supermarkets: normalizeMarkets(
          product.supermarkets.map((market) =>
            equalsIgnoreCase(market, existingName) ? normalizedNewName : market
          )
        )
      }))
    );

    setTemplates((current) =>
      current.map((template) => ({
        ...template,
        supermarkets: normalizeMarkets(
          template.supermarkets.map((market) =>
            equalsIgnoreCase(market, existingName) ? normalizedNewName : market
          )
        )
      }))
    );

    if (equalsIgnoreCase(selectedSupermarket, existingName)) {
      setSelectedSupermarket(normalizedNewName);
    }

    return { success: true, message: "Supermarket updated." };
  };

  const deleteSupermarket = (name: string): ActionResult => {
    const existingName = supermarkets.find((item) => equalsIgnoreCase(item, name));

    if (!existingName) {
      return { success: false, message: "Supermarket not found." };
    }

    const impactedProducts = products.filter((product) =>
      product.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
    ).length;
    const impactedTemplates = templates.filter((template) =>
      template.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
    ).length;

    setSupermarkets((current) =>
      current.filter((item) => !equalsIgnoreCase(item, existingName))
    );

    setProducts((current) =>
      current.map((product) => ({
        ...product,
        supermarkets: product.supermarkets.filter(
          (market) => !equalsIgnoreCase(market, existingName)
        )
      }))
    );

    setTemplates((current) =>
      current.map((template) => ({
        ...template,
        supermarkets: template.supermarkets.filter(
          (market) => !equalsIgnoreCase(market, existingName)
        )
      }))
    );

    if (equalsIgnoreCase(selectedSupermarket, existingName)) {
      setSelectedSupermarket("all");
    }

    return {
      success: true,
      message: `Removed "${existingName}". Updated ${impactedProducts} product(s) and ${impactedTemplates} database item(s).`
    };
  };

  const editTemplate = (
    id: string,
    name: string,
    selectedMarkets: string[]
  ): ActionResult => {
    const normalizedName = sanitizeName(name);
    const normalizedMarkets = normalizeMarkets(selectedMarkets);

    if (!normalizedName) {
      return { success: false, message: "Please enter a product name." };
    }

    if (normalizedMarkets.length === 0) {
      return { success: false, message: "Select at least one supermarket." };
    }

    const existingTemplate = templates.find((template) => template.id === id);
    if (!existingTemplate) {
      return { success: false, message: "Database item not found." };
    }

    const hasConflict = templates.some(
      (template) =>
        template.id !== id && equalsIgnoreCase(template.name, normalizedName)
    );

    if (hasConflict) {
      return { success: false, message: "Another database item already has that name." };
    }

    setTemplates((current) =>
      current.map((template) =>
        template.id === id
          ? {
              ...template,
              name: normalizedName,
              supermarkets: normalizedMarkets
            }
          : template
      )
    );

    return { success: true, message: "Database item updated." };
  };

  const deleteTemplate = (id: string): ActionResult => {
    const existingTemplate = templates.find((template) => template.id === id);
    if (!existingTemplate) {
      return { success: false, message: "Database item not found." };
    }

    setTemplates((current) => current.filter((template) => template.id !== id));
    return { success: true, message: "Database item deleted." };
  };

  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
  };

  const value = useMemo(
    () => ({
      products,
      supermarkets,
      templates,
      filteredProducts,
      searchTerm,
      selectedSupermarket,
      statusFilter,
      isAddModalOpen,
      setSearchTerm,
      setSelectedSupermarket,
      setStatusFilter,
      openAddModal,
      closeAddModal,
      addProduct,
      editProduct,
      deleteProduct,
      toggleProductBought,
      addSupermarket,
      editSupermarket,
      deleteSupermarket,
      editTemplate,
      deleteTemplate
    }),
    [
      products,
      supermarkets,
      templates,
      filteredProducts,
      searchTerm,
      selectedSupermarket,
      statusFilter,
      isAddModalOpen
    ]
  );

  return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
}

export function useShopping() {
  const context = useContext(ShoppingContext);

  if (!context) {
    throw new Error("useShopping must be used within a ShoppingProvider.");
  }

  return context;
}
