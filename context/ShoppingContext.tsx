"use client";

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { isSupabaseConfigured, ProductRow, SupermarketRow, supabase, TemplateRow } from "../lib/supabase";
import {
  ActionResult,
  MoveDirection,
  Product,
  ProductTemplate,
  PurchaseContext,
  SectionBySupermarket
} from "../types";

const DEFAULT_SUPERMARKETS = ["Continente", "Pingo Doce", "Lidl", "Mercadona"];
const PRODUCTS_STORAGE_KEY = "shopping-list-products";
const SUPERMARKETS_STORAGE_KEY = "shopping-list-supermarkets";
const TEMPLATES_STORAGE_KEY = "shopping-list-product-templates";
const SECTIONS_STORAGE_KEY = "shopping-list-sections-by-supermarket";
const ONE_HOUR_MS = 60 * 60 * 1000;

type SectionsBySupermarket = Record<string, string[]>;

export type ProductStatusFilter = "all" | "active" | "bought";
export type SyncMode = "cloud" | "local";

type ShoppingContextValue = {
  products: Product[];
  supermarkets: string[];
  sectionsBySupermarket: SectionsBySupermarket;
  templates: ProductTemplate[];
  filteredProducts: Product[];
  searchTerm: string;
  selectedSupermarket: string;
  statusFilter: ProductStatusFilter;
  isAddModalOpen: boolean;
  isHydrated: boolean;
  syncMode: SyncMode;
  syncError: string;
  setSearchTerm: (value: string) => void;
  setSelectedSupermarket: (value: string) => void;
  setStatusFilter: (value: ProductStatusFilter) => void;
  openAddModal: () => void;
  closeAddModal: () => void;
  addProduct: (
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  editProduct: (
    id: string,
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductBought: (id: string, isBought: boolean, context?: PurchaseContext) => Promise<void>;
  addSupermarket: (name: string) => Promise<ActionResult>;
  editSupermarket: (currentName: string, newName: string) => Promise<ActionResult>;
  deleteSupermarket: (name: string) => Promise<ActionResult>;
  addSectionToSupermarket: (supermarket: string, section: string) => Promise<ActionResult>;
  renameSectionInSupermarket: (
    supermarket: string,
    currentSection: string,
    newSection: string
  ) => Promise<ActionResult>;
  moveSectionInSupermarket: (
    supermarket: string,
    section: string,
    direction: MoveDirection
  ) => Promise<ActionResult>;
  deleteSectionFromSupermarket: (supermarket: string, section: string) => Promise<ActionResult>;
  editTemplate: (
    id: string,
    name: string,
    supermarkets: string[],
    sectionBySupermarket: SectionBySupermarket
  ) => Promise<ActionResult>;
  deleteTemplate: (id: string) => Promise<ActionResult>;
};

const ShoppingContext = createContext<ShoppingContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeName(name: string) {
  return name.trim();
}

function normalizeMarkets(supermarkets: string[]) {
  return Array.from(
    new Set(
      supermarkets
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeSectionName(section: string) {
  return section.trim();
}

function normalizeSectionList(sections: string[]) {
  return Array.from(
    new Set(
      sections
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
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

function normalizeSectionMap(
  supermarkets: string[],
  rawValue: unknown
): SectionBySupermarket {
  const normalizedMarkets = normalizeMarkets(supermarkets);
  const source = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const normalizedEntries = normalizedMarkets.map((market) => {
    const rawSection = source[market];
    if (typeof rawSection !== "string") {
      return [market, null] as const;
    }

    const nextValue = normalizeSectionName(rawSection);
    return [market, nextValue || null] as const;
  });

  return Object.fromEntries(normalizedEntries);
}

function ensureSectionsBySupermarket(
  supermarkets: string[],
  rawValue: unknown
): SectionsBySupermarket {
  const normalizedMarkets = normalizeMarkets(supermarkets);
  const source = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const entries = normalizedMarkets.map((market) => {
    const rawSections = source[market];
    const sections = Array.isArray(rawSections) ? rawSections.map(String) : [];
    return [market, normalizeSectionList(sections)] as const;
  });

  return Object.fromEntries(entries);
}

function updateSectionMapValue(
  current: SectionBySupermarket,
  supermarket: string,
  section: string | null
): SectionBySupermarket {
  return {
    ...current,
    [supermarket]: section && section.trim() ? section.trim() : null
  };
}

function renameSectionMapKey(
  current: SectionBySupermarket,
  previousName: string,
  nextName: string
): SectionBySupermarket {
  const next: SectionBySupermarket = {};

  Object.entries(current).forEach(([market, section]) => {
    next[equalsIgnoreCase(market, previousName) ? nextName : market] = section;
  });

  if (!(nextName in next)) {
    next[nextName] = null;
  }

  return next;
}

function stripSectionMapToMarkets(
  current: SectionBySupermarket,
  supermarkets: string[]
): SectionBySupermarket {
  return normalizeSectionMap(supermarkets, current);
}

function renameSectionInMap(
  current: SectionBySupermarket,
  supermarket: string,
  previousSection: string,
  nextSection: string
): SectionBySupermarket {
  const currentSection = current[supermarket];
  if (!currentSection || !equalsIgnoreCase(currentSection, previousSection)) {
    return { ...current };
  }

  return {
    ...current,
    [supermarket]: nextSection
  };
}

function clearSectionInMap(
  current: SectionBySupermarket,
  supermarket: string,
  sectionToClear: string
): SectionBySupermarket {
  const currentSection = current[supermarket];
  if (!currentSection || !equalsIgnoreCase(currentSection, sectionToClear)) {
    return { ...current };
  }

  return {
    ...current,
    [supermarket]: null
  };
}

function renameSupermarketKey(
  current: SectionsBySupermarket,
  previousName: string,
  nextName: string
): SectionsBySupermarket {
  const next: SectionsBySupermarket = {};

  Object.entries(current).forEach(([market, sections]) => {
    next[equalsIgnoreCase(market, previousName) ? nextName : market] = sections;
  });

  if (!(nextName in next)) {
    next[nextName] = [];
  }

  return next;
}

function sortProducts(products: Product[]) {
  return [...products].sort((a, b) => {
    if (a.isBought === b.isBought) {
      return a.name.localeCompare(b.name);
    }

    return a.isBought ? 1 : -1;
  });
}

function formatErrorMessage(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return "Unexpected error.";
}

function readJson<T>(key: string, fallback: T) {
  try {
    const value = localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function createEmptySectionsMap(supermarkets: string[]) {
  return Object.fromEntries(normalizeMarkets(supermarkets).map((market) => [market, [] as string[]]));
}

function mergeSectionsForMarket(
  current: SectionsBySupermarket,
  supermarket: string,
  nextSection: string
): SectionsBySupermarket {
  const normalizedSection = normalizeSectionName(nextSection);
  if (!normalizedSection) {
    return current;
  }

  const existingSections = current[supermarket] ?? [];
  if (existingSections.some((section) => equalsIgnoreCase(section, normalizedSection))) {
    return current;
  }

  return {
    ...current,
    [supermarket]: [...existingSections, normalizedSection]
  };
}

function toProduct(row: ProductRow): Product {
  const supermarkets = normalizeMarkets(row.supermarkets ?? []);

  return {
    id: row.id,
    name: sanitizeName(row.name),
    supermarkets,
    sectionBySupermarket: normalizeSectionMap(supermarkets, row.section_by_supermarket),
    isBought: Boolean(row.is_bought),
    boughtAt: row.is_bought ? row.bought_at : null
  };
}

function toTemplate(row: TemplateRow): ProductTemplate {
  const supermarkets = normalizeMarkets(row.supermarkets ?? []);

  return {
    id: row.id,
    name: sanitizeName(row.name),
    supermarkets,
    sectionBySupermarket: normalizeSectionMap(supermarkets, row.section_by_supermarket),
    purchaseLog: Array.isArray(row.purchase_log) ? row.purchase_log : []
  };
}

function toSectionsBySupermarket(rows: SupermarketRow[]) {
  const entries = rows.map((row) => [row.name, normalizeSectionList(row.sections ?? [])] as const);
  return Object.fromEntries(entries) as SectionsBySupermarket;
}

function upsertTemplateMarkets(
  templates: ProductTemplate[],
  productName: string,
  productMarkets: string[],
  sectionBySupermarket: SectionBySupermarket
) {
  const existingIndex = templates.findIndex((template) =>
    equalsIgnoreCase(template.name, productName)
  );
  const normalizedMarkets = normalizeMarkets(productMarkets);
  const normalizedSectionMap = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);

  if (existingIndex === -1) {
    return [
      {
        id: createId(),
        name: productName,
        supermarkets: normalizedMarkets,
        sectionBySupermarket: normalizedSectionMap,
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
          supermarkets: normalizedMarkets,
          sectionBySupermarket: normalizeSectionMap(normalizedMarkets, {
            ...template.sectionBySupermarket,
            ...normalizedSectionMap
          })
        }
      : template
  );
}

function appendTemplateLog(
  templates: ProductTemplate[],
  productName: string,
  productMarkets: string[],
  sectionBySupermarket: SectionBySupermarket,
  boughtTimestamp: string
) {
  const existingIndex = templates.findIndex((template) =>
    equalsIgnoreCase(template.name, productName)
  );
  const normalizedMarkets = normalizeMarkets(productMarkets);
  const normalizedSectionMap = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);

  if (existingIndex === -1) {
    return [
      {
        id: createId(),
        name: productName,
        supermarkets: normalizedMarkets,
        sectionBySupermarket: normalizedSectionMap,
        purchaseLog: [boughtTimestamp]
      },
      ...templates
    ];
  }

  return templates.map((template, index) => {
    if (index !== existingIndex) {
      return template;
    }

    const mergedMarkets = normalizeMarkets([...template.supermarkets, ...normalizedMarkets]);
    return {
      ...template,
      supermarkets: mergedMarkets,
      sectionBySupermarket: normalizeSectionMap(mergedMarkets, {
        ...template.sectionBySupermarket,
        ...normalizedSectionMap
      }),
      purchaseLog: [...template.purchaseLog, boughtTimestamp]
    };
  });
}

type ShoppingProviderProps = {
  children: ReactNode;
};

export function ShoppingProvider({ children }: ShoppingProviderProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [supermarkets, setSupermarkets] = useState<string[]>(DEFAULT_SUPERMARKETS);
  const [sectionsBySupermarket, setSectionsBySupermarket] = useState<SectionsBySupermarket>(
    createEmptySectionsMap(DEFAULT_SUPERMARKETS)
  );
  const [templates, setTemplates] = useState<ProductTemplate[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupermarket, setSelectedSupermarket] = useState("all");
  const [statusFilter, setStatusFilter] = useState<ProductStatusFilter>("all");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncMode, setSyncMode] = useState<SyncMode>(
    isSupabaseConfigured ? "cloud" : "local"
  );
  const [syncError, setSyncError] = useState("");

  const isRefreshingRef = useRef(false);
  const productsRef = useRef<Product[]>([]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  const hydrateLocal = useCallback(() => {
    const rawProducts = readJson<Product[]>(PRODUCTS_STORAGE_KEY, []);
    const rawSupermarkets = readJson<string[]>(SUPERMARKETS_STORAGE_KEY, DEFAULT_SUPERMARKETS);
    const rawTemplates = readJson<ProductTemplate[]>(TEMPLATES_STORAGE_KEY, []);
    const normalizedSupermarkets = normalizeMarkets(
      Array.isArray(rawSupermarkets) ? rawSupermarkets : DEFAULT_SUPERMARKETS
    );
    const rawSectionsBySupermarket = readJson<SectionsBySupermarket>(
      SECTIONS_STORAGE_KEY,
      createEmptySectionsMap(normalizedSupermarkets)
    );

    const safeProducts = pruneExpiredProducts(
      (Array.isArray(rawProducts) ? rawProducts : []).map((product) => {
        const productMarkets = normalizeMarkets(
          Array.isArray(product.supermarkets) ? product.supermarkets : []
        );

        return {
          id: String(product.id),
          name: sanitizeName(String(product.name ?? "")),
          supermarkets: productMarkets,
          sectionBySupermarket: normalizeSectionMap(productMarkets, product.sectionBySupermarket),
          isBought: Boolean(product.isBought),
          boughtAt: product.boughtAt ? String(product.boughtAt) : null
        } satisfies Product;
      })
    ).filter((product) => product.id && product.name);

    const safeTemplates = (Array.isArray(rawTemplates) ? rawTemplates : [])
      .map((template) => {
        const templateMarkets = normalizeMarkets(
          Array.isArray(template.supermarkets) ? template.supermarkets : []
        );

        return {
          id: String(template.id),
          name: sanitizeName(String(template.name ?? "")),
          supermarkets: templateMarkets,
          sectionBySupermarket: normalizeSectionMap(templateMarkets, template.sectionBySupermarket),
          purchaseLog: Array.isArray(template.purchaseLog) ? template.purchaseLog.map(String) : []
        } satisfies ProductTemplate;
      })
      .filter((template) => template.id && template.name);

    const mergedTemplates = safeProducts.reduce(
      (current, product) =>
        upsertTemplateMarkets(
          current,
          product.name,
          product.supermarkets,
          product.sectionBySupermarket
        ),
      safeTemplates
    );

    const nextSupermarkets =
      normalizedSupermarkets.length > 0 ? normalizedSupermarkets : [...DEFAULT_SUPERMARKETS];
    const nextSectionsBySupermarket = ensureSectionsBySupermarket(
      nextSupermarkets,
      rawSectionsBySupermarket
    );

    setProducts(sortProducts(safeProducts));
    setSupermarkets(nextSupermarkets);
    setSectionsBySupermarket(nextSectionsBySupermarket);
    setTemplates(mergedTemplates);
  }, []);

  const refreshFromCloud = useCallback(async () => {
    if (!supabase || isRefreshingRef.current) {
      return;
    }

    isRefreshingRef.current = true;

    try {
      const [productsResponse, supermarketsResponse, templatesResponse] = await Promise.all([
        supabase.from("products").select("*").order("created_at", { ascending: false }),
        supabase.from("supermarkets").select("*").order("created_at", { ascending: true }),
        supabase.from("templates").select("*").order("name", { ascending: true })
      ]);

      if (productsResponse.error || supermarketsResponse.error || templatesResponse.error) {
        throw productsResponse.error ?? supermarketsResponse.error ?? templatesResponse.error;
      }

      let nextProducts = (productsResponse.data ?? []).map((row) => toProduct(row as ProductRow));
      const expiredIds = nextProducts
        .filter((product) => isExpiredBoughtProduct(product, Date.now()))
        .map((product) => product.id);

      if (expiredIds.length > 0) {
        const { error } = await supabase.from("products").delete().in("id", expiredIds);
        if (error) {
          throw error;
        }
        nextProducts = nextProducts.filter((product) => !expiredIds.includes(product.id));
      }

      let nextSupermarketRows = (supermarketsResponse.data ?? []) as SupermarketRow[];
      let nextSupermarkets = normalizeMarkets(nextSupermarketRows.map((row) => String(row.name)));

      if (nextSupermarkets.length === 0) {
        const { error } = await supabase
          .from("supermarkets")
          .upsert(
            DEFAULT_SUPERMARKETS.map((name) => ({ name, sections: [] as string[] })),
            { onConflict: "name" }
          );

        if (error) {
          throw error;
        }

        const refreshedSupermarkets = await supabase
          .from("supermarkets")
          .select("*")
          .order("created_at", { ascending: true });

        if (refreshedSupermarkets.error) {
          throw refreshedSupermarkets.error;
        }

        nextSupermarketRows = (refreshedSupermarkets.data ?? []) as SupermarketRow[];
        nextSupermarkets = normalizeMarkets(nextSupermarketRows.map((row) => String(row.name)));
      }

      const nextSections = ensureSectionsBySupermarket(
        nextSupermarkets,
        toSectionsBySupermarket(nextSupermarketRows)
      );

      let nextTemplates = (templatesResponse.data ?? []).map((row) => toTemplate(row as TemplateRow));
      const missingTemplates = nextProducts
        .filter((product) => !nextTemplates.some((template) => equalsIgnoreCase(template.name, product.name)))
        .map((product) => ({
          name: product.name,
          supermarkets: product.supermarkets,
          section_by_supermarket: product.sectionBySupermarket,
          purchase_log: [] as string[]
        }));

      if (missingTemplates.length > 0) {
        const { error } = await supabase
          .from("templates")
          .upsert(missingTemplates, { onConflict: "name" });
        if (error) {
          throw error;
        }

        const refreshedTemplates = await supabase
          .from("templates")
          .select("*")
          .order("name", { ascending: true });

        if (!refreshedTemplates.error) {
          nextTemplates = (refreshedTemplates.data ?? []).map((row) => toTemplate(row as TemplateRow));
        }
      }

      setProducts(sortProducts(nextProducts));
      setSupermarkets(nextSupermarkets);
      setSectionsBySupermarket(nextSections);
      setTemplates(nextTemplates);
      setSyncMode("cloud");
      setSyncError("");
    } finally {
      isRefreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      if (supabase) {
        try {
          await refreshFromCloud();
          if (isMounted) {
            setSyncMode("cloud");
            setIsHydrated(true);
          }
          return;
        } catch (error) {
          if (isMounted) {
            setSyncMode("local");
            setSyncError(`Cloud sync unavailable: ${formatErrorMessage(error)}`);
          }
        }
      }

      if (isMounted) {
        hydrateLocal();
        setIsHydrated(true);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [hydrateLocal, refreshFromCloud]);

  useEffect(() => {
    if (!isHydrated || syncMode !== "local") {
      return;
    }

    localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(products));
    localStorage.setItem(SUPERMARKETS_STORAGE_KEY, JSON.stringify(supermarkets));
    localStorage.setItem(SECTIONS_STORAGE_KEY, JSON.stringify(sectionsBySupermarket));
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  }, [products, supermarkets, sectionsBySupermarket, templates, isHydrated, syncMode]);

  useEffect(() => {
    if (!isHydrated || syncMode !== "cloud" || !supabase) {
      return;
    }

    const client = supabase;
    const channel = client
      .channel("shopping-list-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        void refreshFromCloud();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "supermarkets" }, () => {
        void refreshFromCloud();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "templates" }, () => {
        void refreshFromCloud();
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          setSyncError("Realtime disconnected.");
        }
      });

    return () => {
      void client.removeChannel(channel);
    };
  }, [isHydrated, syncMode, refreshFromCloud]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (syncMode === "local") {
      const intervalId = window.setInterval(() => {
        setProducts((current) => sortProducts(pruneExpiredProducts(current)));
      }, 1000);

      return () => {
        window.clearInterval(intervalId);
      };
    }

    if (syncMode === "cloud" && supabase) {
      const client = supabase;
      const pruneCloud = async () => {
        const expiredIds = productsRef.current
          .filter((product) => isExpiredBoughtProduct(product, Date.now()))
          .map((product) => product.id);

        if (expiredIds.length === 0) {
          return;
        }

        const { error } = await client.from("products").delete().in("id", expiredIds);
        if (!error) {
          await refreshFromCloud();
        }
      };

      void pruneCloud();
      const intervalId = window.setInterval(() => {
        void pruneCloud();
      }, 15000);

      return () => {
        window.clearInterval(intervalId);
      };
    }
  }, [isHydrated, syncMode, refreshFromCloud]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return sortProducts(
      products.filter((product) => {
        const matchesName = product.name.toLowerCase().includes(normalizedSearch);
        const matchesSupermarket =
          selectedSupermarket === "all" || product.supermarkets.includes(selectedSupermarket);
        const matchesStatus =
          statusFilter === "all" || (statusFilter === "active" ? !product.isBought : product.isBought);

        return matchesName && matchesSupermarket && matchesStatus;
      })
    );
  }, [products, searchTerm, selectedSupermarket, statusFilter]);

  const upsertTemplateMarketsCloud = useCallback(
    async (
      name: string,
      selectedMarkets: string[],
      sectionBySupermarket: SectionBySupermarket
    ) => {
      if (!supabase) {
        return;
      }

      const normalizedMarkets = normalizeMarkets(selectedMarkets);
      const normalizedSections = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);
      const existingTemplate = templates.find((template) => equalsIgnoreCase(template.name, name));

      if (!existingTemplate) {
        await supabase.from("templates").insert({
          name,
          supermarkets: normalizedMarkets,
          section_by_supermarket: normalizedSections,
          purchase_log: []
        });
        return;
      }

      await supabase
        .from("templates")
        .update({
          name,
          supermarkets: normalizedMarkets,
          section_by_supermarket: normalizeSectionMap(normalizedMarkets, {
            ...existingTemplate.sectionBySupermarket,
            ...normalizedSections
          })
        })
        .eq("id", existingTemplate.id);
    },
    [templates]
  );

  const appendTemplateLogCloud = useCallback(
    async (
      name: string,
      selectedMarkets: string[],
      sectionBySupermarket: SectionBySupermarket,
      boughtTimestamp: string
    ) => {
      if (!supabase) {
        return;
      }

      const normalizedMarkets = normalizeMarkets(selectedMarkets);
      const normalizedSections = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);
      const existingTemplate = templates.find((template) => equalsIgnoreCase(template.name, name));

      if (!existingTemplate) {
        await supabase.from("templates").insert({
          name,
          supermarkets: normalizedMarkets,
          section_by_supermarket: normalizedSections,
          purchase_log: [boughtTimestamp]
        });
        return;
      }

      const mergedMarkets = normalizeMarkets([...existingTemplate.supermarkets, ...normalizedMarkets]);
      await supabase
        .from("templates")
        .update({
          supermarkets: mergedMarkets,
          section_by_supermarket: normalizeSectionMap(mergedMarkets, {
            ...existingTemplate.sectionBySupermarket,
            ...normalizedSections
          }),
          purchase_log: [...existingTemplate.purchaseLog, boughtTimestamp]
        })
        .eq("id", existingTemplate.id);
    },
    [templates]
  );

  const syncSectionIntoStore = useCallback(
    async (supermarket: string, sectionName: string) => {
      const normalizedSection = normalizeSectionName(sectionName);
      if (!normalizedSection) {
        return;
      }

      const existingSections = sectionsBySupermarket[supermarket] ?? [];
      if (existingSections.some((section) => equalsIgnoreCase(section, normalizedSection))) {
        return;
      }

      if (syncMode === "local" || !supabase) {
        setSectionsBySupermarket((current) => mergeSectionsForMarket(current, supermarket, normalizedSection));
        return;
      }

      const { error } = await supabase
        .from("supermarkets")
        .update({ sections: [...existingSections, normalizedSection] })
        .eq("name", supermarket);

      if (error) {
        throw error;
      }
    },
    [sectionsBySupermarket, syncMode]
  );

  const addProduct = useCallback(
    async (
      name: string,
      selectedMarkets: string[],
      sectionBySupermarket: SectionBySupermarket
    ): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);
      const normalizedSections = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);

      if (!normalizedName) {
        return { success: false, message: "Please enter a product name." };
      }

      if (normalizedMarkets.length === 0) {
        return { success: false, message: "Select at least one supermarket." };
      }

      for (const market of normalizedMarkets) {
        const sectionName = normalizedSections[market];
        if (sectionName) {
          await syncSectionIntoStore(market, sectionName);
        }
      }

      if (syncMode === "local" || !supabase) {
        setProducts((current) =>
          sortProducts([
            {
              id: createId(),
              name: normalizedName,
              supermarkets: normalizedMarkets,
              sectionBySupermarket: normalizedSections,
              isBought: false,
              boughtAt: null
            },
            ...current
          ])
        );

        setTemplates((current) =>
          upsertTemplateMarkets(current, normalizedName, normalizedMarkets, normalizedSections)
        );
        return { success: true, message: `Added "${normalizedName}".` };
      }

      const { error: insertError } = await supabase.from("products").insert({
        id: createId(),
        name: normalizedName,
        supermarkets: normalizedMarkets,
        section_by_supermarket: normalizedSections,
        is_bought: false,
        bought_at: null
      });

      if (insertError) {
        return { success: false, message: insertError.message };
      }

      await upsertTemplateMarketsCloud(normalizedName, normalizedMarkets, normalizedSections);
      await refreshFromCloud();
      return { success: true, message: `Added "${normalizedName}".` };
    },
    [refreshFromCloud, syncMode, syncSectionIntoStore, upsertTemplateMarketsCloud]
  );

  const editProduct = useCallback(
    async (
      id: string,
      name: string,
      selectedMarkets: string[],
      sectionBySupermarket: SectionBySupermarket
    ): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);
      const normalizedSections = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);

      if (!normalizedName) {
        return { success: false, message: "Please enter a product name." };
      }

      if (normalizedMarkets.length === 0) {
        return { success: false, message: "Select at least one supermarket." };
      }

      for (const market of normalizedMarkets) {
        const sectionName = normalizedSections[market];
        if (sectionName) {
          await syncSectionIntoStore(market, sectionName);
        }
      }

      if (syncMode === "local" || !supabase) {
        setProducts((current) =>
          sortProducts(
            current.map((product) =>
              product.id === id
                ? {
                    ...product,
                    name: normalizedName,
                    supermarkets: normalizedMarkets,
                    sectionBySupermarket: normalizedSections
                  }
                : product
            )
          )
        );

        setTemplates((current) =>
          upsertTemplateMarkets(current, normalizedName, normalizedMarkets, normalizedSections)
        );
        return { success: true, message: "Product updated." };
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({
          name: normalizedName,
          supermarkets: normalizedMarkets,
          section_by_supermarket: normalizedSections
        })
        .eq("id", id);

      if (updateError) {
        return { success: false, message: updateError.message };
      }

      await upsertTemplateMarketsCloud(normalizedName, normalizedMarkets, normalizedSections);
      await refreshFromCloud();
      return { success: true, message: "Product updated." };
    },
    [refreshFromCloud, syncMode, syncSectionIntoStore, upsertTemplateMarketsCloud]
  );

  const deleteProduct = useCallback(
    async (id: string) => {
      if (syncMode === "local" || !supabase) {
        setProducts((current) => current.filter((product) => product.id !== id));
        return;
      }

      await supabase.from("products").delete().eq("id", id);
      await refreshFromCloud();
    },
    [refreshFromCloud, syncMode]
  );

  const toggleProductBought = useCallback(
    async (id: string, isBought: boolean, purchaseContext?: PurchaseContext) => {
      const boughtTimestamp = new Date().toISOString();

      if (syncMode === "local" || !supabase) {
        let boughtProductName = "";
        let boughtProductMarkets: string[] = [];
        let boughtSectionMap: SectionBySupermarket = {};
        let sectionToPersist: { supermarket: string; sectionName: string } | null = null;

        setProducts((current) =>
          sortProducts(
            current.map((product) => {
              if (product.id !== id) {
                return product;
              }

              if (isBought && !product.isBought) {
                boughtProductName = product.name;
                boughtProductMarkets = product.supermarkets;

                const resolvedSupermarket =
                  purchaseContext?.supermarket ??
                  (selectedSupermarket !== "all" && product.supermarkets.includes(selectedSupermarket)
                    ? selectedSupermarket
                    : product.supermarkets[0] ?? null);
                const resolvedSection = normalizeSectionName(purchaseContext?.sectionName ?? "");
                let nextSectionMap = { ...product.sectionBySupermarket };

                if (resolvedSupermarket && resolvedSection) {
                  nextSectionMap = updateSectionMapValue(nextSectionMap, resolvedSupermarket, resolvedSection);
                  sectionToPersist = {
                    supermarket: resolvedSupermarket,
                    sectionName: resolvedSection
                  };
                }

                boughtSectionMap = stripSectionMapToMarkets(nextSectionMap, product.supermarkets);
                return {
                  ...product,
                  sectionBySupermarket: boughtSectionMap,
                  isBought: true,
                  boughtAt: boughtTimestamp
                };
              }

              if (!isBought && product.isBought) {
                return { ...product, isBought: false, boughtAt: null };
              }

              return product;
            })
          )
        );

        if (sectionToPersist) {
          setSectionsBySupermarket((current) =>
            mergeSectionsForMarket(current, sectionToPersist!.supermarket, sectionToPersist!.sectionName)
          );
        }

        if (isBought && boughtProductName) {
          setTemplates((current) =>
            appendTemplateLog(
              current,
              boughtProductName,
              boughtProductMarkets,
              boughtSectionMap,
              boughtTimestamp
            )
          );
        }

        return;
      }

      const targetProduct = products.find((product) => product.id === id);
      if (!targetProduct) {
        return;
      }

      const resolvedSupermarket =
        purchaseContext?.supermarket ??
        (selectedSupermarket !== "all" && targetProduct.supermarkets.includes(selectedSupermarket)
          ? selectedSupermarket
          : targetProduct.supermarkets[0] ?? null);
      const resolvedSection = normalizeSectionName(purchaseContext?.sectionName ?? "");
      const nextSectionMap =
        isBought && resolvedSupermarket && resolvedSection
          ? updateSectionMapValue(targetProduct.sectionBySupermarket, resolvedSupermarket, resolvedSection)
          : targetProduct.sectionBySupermarket;

      if (isBought && resolvedSupermarket && resolvedSection) {
        await syncSectionIntoStore(resolvedSupermarket, resolvedSection);
      }

      await supabase
        .from("products")
        .update({
          section_by_supermarket: stripSectionMapToMarkets(nextSectionMap, targetProduct.supermarkets),
          is_bought: isBought,
          bought_at: isBought ? boughtTimestamp : null
        })
        .eq("id", id);

      if (isBought && !targetProduct.isBought) {
        await appendTemplateLogCloud(
          targetProduct.name,
          targetProduct.supermarkets,
          stripSectionMapToMarkets(nextSectionMap, targetProduct.supermarkets),
          boughtTimestamp
        );
      }

      await refreshFromCloud();
    },
    [
      appendTemplateLogCloud,
      products,
      refreshFromCloud,
      selectedSupermarket,
      syncMode,
      syncSectionIntoStore
    ]
  );

  const addSupermarket = useCallback(
    async (name: string): Promise<ActionResult> => {
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

      if (syncMode === "local" || !supabase) {
        setSupermarkets((current) => [...current, normalizedName]);
        setSectionsBySupermarket((current) => ({ ...current, [normalizedName]: [] }));
        return { success: true, message: "Supermarket added successfully." };
      }

      const { error } = await supabase.from("supermarkets").insert({
        name: normalizedName,
        sections: []
      });
      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Supermarket added successfully." };
    },
    [refreshFromCloud, supermarkets, syncMode]
  );

  const editSupermarket = useCallback(
    async (currentName: string, newName: string): Promise<ActionResult> => {
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

      if (syncMode === "local" || !supabase) {
        setSupermarkets((current) =>
          current.map((item) => (equalsIgnoreCase(item, existingName) ? normalizedNewName : item))
        );

        setSectionsBySupermarket((current) =>
          renameSupermarketKey(current, existingName, normalizedNewName)
        );

        setProducts((current) =>
          current.map((product) => ({
            ...product,
            supermarkets: normalizeMarkets(
              product.supermarkets.map((market) =>
                equalsIgnoreCase(market, existingName) ? normalizedNewName : market
              )
            ),
            sectionBySupermarket: renameSectionMapKey(
              product.sectionBySupermarket,
              existingName,
              normalizedNewName
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
            ),
            sectionBySupermarket: renameSectionMapKey(
              template.sectionBySupermarket,
              existingName,
              normalizedNewName
            )
          }))
        );

        if (equalsIgnoreCase(selectedSupermarket, existingName)) {
          setSelectedSupermarket(normalizedNewName);
        }

        return { success: true, message: "Supermarket updated." };
      }

      const client = supabase;
      const impactedProducts = products.filter((product) =>
        product.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
      );
      const impactedTemplates = templates.filter((template) =>
        template.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
      );
      const existingSections = sectionsBySupermarket[existingName] ?? [];

      await client
        .from("supermarkets")
        .update({ name: normalizedNewName, sections: existingSections })
        .eq("name", existingName);

      await Promise.all([
        ...impactedProducts.map((product) => {
          const nextMarkets = normalizeMarkets(
            product.supermarkets.map((market) =>
              equalsIgnoreCase(market, existingName) ? normalizedNewName : market
            )
          );

          return client
            .from("products")
            .update({
              supermarkets: nextMarkets,
              section_by_supermarket: stripSectionMapToMarkets(
                renameSectionMapKey(product.sectionBySupermarket, existingName, normalizedNewName),
                nextMarkets
              )
            })
            .eq("id", product.id);
        }),
        ...impactedTemplates.map((template) => {
          const nextMarkets = normalizeMarkets(
            template.supermarkets.map((market) =>
              equalsIgnoreCase(market, existingName) ? normalizedNewName : market
            )
          );

          return client
            .from("templates")
            .update({
              supermarkets: nextMarkets,
              section_by_supermarket: stripSectionMapToMarkets(
                renameSectionMapKey(template.sectionBySupermarket, existingName, normalizedNewName),
                nextMarkets
              )
            })
            .eq("id", template.id);
        })
      ]);

      if (equalsIgnoreCase(selectedSupermarket, existingName)) {
        setSelectedSupermarket(normalizedNewName);
      }

      await refreshFromCloud();
      return { success: true, message: "Supermarket updated." };
    },
    [
      products,
      refreshFromCloud,
      sectionsBySupermarket,
      selectedSupermarket,
      supermarkets,
      syncMode,
      templates
    ]
  );

  const deleteSupermarket = useCallback(
    async (name: string): Promise<ActionResult> => {
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

      if (syncMode === "local" || !supabase) {
        setSupermarkets((current) => current.filter((item) => !equalsIgnoreCase(item, existingName)));
        setSectionsBySupermarket((current) => {
          const next = { ...current };
          delete next[existingName];
          return next;
        });
        setProducts((current) =>
          current.map((product) => {
            const nextMarkets = product.supermarkets.filter(
              (market) => !equalsIgnoreCase(market, existingName)
            );

            return {
              ...product,
              supermarkets: nextMarkets,
              sectionBySupermarket: stripSectionMapToMarkets(
                product.sectionBySupermarket,
                nextMarkets
              )
            };
          })
        );
        setTemplates((current) =>
          current.map((template) => {
            const nextMarkets = template.supermarkets.filter(
              (market) => !equalsIgnoreCase(market, existingName)
            );

            return {
              ...template,
              supermarkets: nextMarkets,
              sectionBySupermarket: stripSectionMapToMarkets(
                template.sectionBySupermarket,
                nextMarkets
              )
            };
          })
        );

        if (equalsIgnoreCase(selectedSupermarket, existingName)) {
          setSelectedSupermarket("all");
        }

        return {
          success: true,
          message: `Removed "${existingName}". Updated ${impactedProducts} product(s) and ${impactedTemplates} database item(s).`
        };
      }

      const client = supabase;
      await client.from("supermarkets").delete().eq("name", existingName);

      await Promise.all([
        ...products
          .filter((product) => product.supermarkets.some((market) => equalsIgnoreCase(market, existingName)))
          .map((product) => {
            const nextMarkets = product.supermarkets.filter(
              (market) => !equalsIgnoreCase(market, existingName)
            );

            return client
              .from("products")
              .update({
                supermarkets: nextMarkets,
                section_by_supermarket: stripSectionMapToMarkets(
                  product.sectionBySupermarket,
                  nextMarkets
                )
              })
              .eq("id", product.id);
          }),
        ...templates
          .filter((template) => template.supermarkets.some((market) => equalsIgnoreCase(market, existingName)))
          .map((template) => {
            const nextMarkets = template.supermarkets.filter(
              (market) => !equalsIgnoreCase(market, existingName)
            );

            return client
              .from("templates")
              .update({
                supermarkets: nextMarkets,
                section_by_supermarket: stripSectionMapToMarkets(
                  template.sectionBySupermarket,
                  nextMarkets
                )
              })
              .eq("id", template.id);
          })
      ]);

      if (equalsIgnoreCase(selectedSupermarket, existingName)) {
        setSelectedSupermarket("all");
      }

      await refreshFromCloud();
      return {
        success: true,
        message: `Removed "${existingName}". Updated ${impactedProducts} product(s) and ${impactedTemplates} database item(s).`
      };
    },
    [products, refreshFromCloud, selectedSupermarket, supermarkets, syncMode, templates]
  );

  const addSectionToSupermarket = useCallback(
    async (supermarket: string, section: string): Promise<ActionResult> => {
      const normalizedSupermarket = supermarkets.find((item) => equalsIgnoreCase(item, supermarket));
      const normalizedSection = normalizeSectionName(section);

      if (!normalizedSupermarket) {
        return { success: false, message: "Supermarket not found." };
      }

      if (!normalizedSection) {
        return { success: false, message: "Please enter a section name." };
      }

      const existingSections = sectionsBySupermarket[normalizedSupermarket] ?? [];
      if (existingSections.some((item) => equalsIgnoreCase(item, normalizedSection))) {
        return { success: false, message: "That section already exists." };
      }

      const nextSections = [...existingSections, normalizedSection];

      if (syncMode === "local" || !supabase) {
        setSectionsBySupermarket((current) => ({
          ...current,
          [normalizedSupermarket]: nextSections
        }));
        return { success: true, message: "Section added." };
      }

      const { error } = await supabase
        .from("supermarkets")
        .update({ sections: nextSections })
        .eq("name", normalizedSupermarket);
      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Section added." };
    },
    [refreshFromCloud, sectionsBySupermarket, supermarkets, syncMode]
  );

  const renameSectionInSupermarket = useCallback(
    async (
      supermarket: string,
      currentSection: string,
      newSection: string
    ): Promise<ActionResult> => {
      const normalizedSupermarket = supermarkets.find((item) => equalsIgnoreCase(item, supermarket));
      const normalizedCurrentSection = normalizeSectionName(currentSection);
      const normalizedNewSection = normalizeSectionName(newSection);

      if (!normalizedSupermarket) {
        return { success: false, message: "Supermarket not found." };
      }

      if (!normalizedCurrentSection) {
        return { success: false, message: "Section not found." };
      }

      if (!normalizedNewSection) {
        return { success: false, message: "Please enter a section name." };
      }

      const existingSections = sectionsBySupermarket[normalizedSupermarket] ?? [];
      if (!existingSections.some((item) => equalsIgnoreCase(item, normalizedCurrentSection))) {
        return { success: false, message: "Section not found." };
      }

      const hasConflict = existingSections.some(
        (item) => !equalsIgnoreCase(item, normalizedCurrentSection) && equalsIgnoreCase(item, normalizedNewSection)
      );
      if (hasConflict) {
        return { success: false, message: "Another section already has that name." };
      }

      const nextSections = existingSections.map((item) =>
        equalsIgnoreCase(item, normalizedCurrentSection) ? normalizedNewSection : item
      );

      if (syncMode === "local" || !supabase) {
        setSectionsBySupermarket((current) => ({
          ...current,
          [normalizedSupermarket]: nextSections
        }));
        setProducts((current) =>
          current.map((product) => ({
            ...product,
            sectionBySupermarket: renameSectionInMap(
              product.sectionBySupermarket,
              normalizedSupermarket,
              normalizedCurrentSection,
              normalizedNewSection
            )
          }))
        );
        setTemplates((current) =>
          current.map((template) => ({
            ...template,
            sectionBySupermarket: renameSectionInMap(
              template.sectionBySupermarket,
              normalizedSupermarket,
              normalizedCurrentSection,
              normalizedNewSection
            )
          }))
        );
        return { success: true, message: "Section updated." };
      }

      const client = supabase;
      await client
        .from("supermarkets")
        .update({ sections: nextSections })
        .eq("name", normalizedSupermarket);

      const impactedProducts = products.filter(
        (product) => product.sectionBySupermarket[normalizedSupermarket] &&
          equalsIgnoreCase(product.sectionBySupermarket[normalizedSupermarket]!, normalizedCurrentSection)
      );
      const impactedTemplates = templates.filter(
        (template) => template.sectionBySupermarket[normalizedSupermarket] &&
          equalsIgnoreCase(template.sectionBySupermarket[normalizedSupermarket]!, normalizedCurrentSection)
      );

      await Promise.all([
        ...impactedProducts.map((product) =>
          client
            .from("products")
            .update({
              section_by_supermarket: renameSectionInMap(
                product.sectionBySupermarket,
                normalizedSupermarket,
                normalizedCurrentSection,
                normalizedNewSection
              )
            })
            .eq("id", product.id)
        ),
        ...impactedTemplates.map((template) =>
          client
            .from("templates")
            .update({
              section_by_supermarket: renameSectionInMap(
                template.sectionBySupermarket,
                normalizedSupermarket,
                normalizedCurrentSection,
                normalizedNewSection
              )
            })
            .eq("id", template.id)
        )
      ]);

      await refreshFromCloud();
      return { success: true, message: "Section updated." };
    },
    [products, refreshFromCloud, sectionsBySupermarket, supermarkets, syncMode, templates]
  );

  const moveSectionInSupermarket = useCallback(
    async (
      supermarket: string,
      section: string,
      direction: MoveDirection
    ): Promise<ActionResult> => {
      const normalizedSupermarket = supermarkets.find((item) => equalsIgnoreCase(item, supermarket));
      const normalizedSection = normalizeSectionName(section);

      if (!normalizedSupermarket) {
        return { success: false, message: "Supermarket not found." };
      }

      const existingSections = [...(sectionsBySupermarket[normalizedSupermarket] ?? [])];
      const currentIndex = existingSections.findIndex((item) => equalsIgnoreCase(item, normalizedSection));
      if (currentIndex === -1) {
        return { success: false, message: "Section not found." };
      }

      const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0 || nextIndex >= existingSections.length) {
        return { success: false, message: "Section is already at the edge." };
      }

      const [movedSection] = existingSections.splice(currentIndex, 1);
      existingSections.splice(nextIndex, 0, movedSection);

      if (syncMode === "local" || !supabase) {
        setSectionsBySupermarket((current) => ({
          ...current,
          [normalizedSupermarket]: existingSections
        }));
        return { success: true, message: "Section order updated." };
      }

      const { error } = await supabase
        .from("supermarkets")
        .update({ sections: existingSections })
        .eq("name", normalizedSupermarket);
      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Section order updated." };
    },
    [refreshFromCloud, sectionsBySupermarket, supermarkets, syncMode]
  );

  const deleteSectionFromSupermarket = useCallback(
    async (supermarket: string, section: string): Promise<ActionResult> => {
      const normalizedSupermarket = supermarkets.find((item) => equalsIgnoreCase(item, supermarket));
      const normalizedSection = normalizeSectionName(section);

      if (!normalizedSupermarket) {
        return { success: false, message: "Supermarket not found." };
      }

      const existingSections = sectionsBySupermarket[normalizedSupermarket] ?? [];
      if (!existingSections.some((item) => equalsIgnoreCase(item, normalizedSection))) {
        return { success: false, message: "Section not found." };
      }

      const nextSections = existingSections.filter(
        (item) => !equalsIgnoreCase(item, normalizedSection)
      );

      if (syncMode === "local" || !supabase) {
        setSectionsBySupermarket((current) => ({
          ...current,
          [normalizedSupermarket]: nextSections
        }));
        setProducts((current) =>
          current.map((product) => ({
            ...product,
            sectionBySupermarket: clearSectionInMap(
              product.sectionBySupermarket,
              normalizedSupermarket,
              normalizedSection
            )
          }))
        );
        setTemplates((current) =>
          current.map((template) => ({
            ...template,
            sectionBySupermarket: clearSectionInMap(
              template.sectionBySupermarket,
              normalizedSupermarket,
              normalizedSection
            )
          }))
        );
        return { success: true, message: "Section deleted." };
      }

      const client = supabase;
      await client
        .from("supermarkets")
        .update({ sections: nextSections })
        .eq("name", normalizedSupermarket);

      const impactedProducts = products.filter(
        (product) => product.sectionBySupermarket[normalizedSupermarket] &&
          equalsIgnoreCase(product.sectionBySupermarket[normalizedSupermarket]!, normalizedSection)
      );
      const impactedTemplates = templates.filter(
        (template) => template.sectionBySupermarket[normalizedSupermarket] &&
          equalsIgnoreCase(template.sectionBySupermarket[normalizedSupermarket]!, normalizedSection)
      );

      await Promise.all([
        ...impactedProducts.map((product) =>
          client
            .from("products")
            .update({
              section_by_supermarket: clearSectionInMap(
                product.sectionBySupermarket,
                normalizedSupermarket,
                normalizedSection
              )
            })
            .eq("id", product.id)
        ),
        ...impactedTemplates.map((template) =>
          client
            .from("templates")
            .update({
              section_by_supermarket: clearSectionInMap(
                template.sectionBySupermarket,
                normalizedSupermarket,
                normalizedSection
              )
            })
            .eq("id", template.id)
        )
      ]);

      await refreshFromCloud();
      return { success: true, message: "Section deleted." };
    },
    [products, refreshFromCloud, sectionsBySupermarket, supermarkets, syncMode, templates]
  );

  const editTemplate = useCallback(
    async (
      id: string,
      name: string,
      selectedMarkets: string[],
      sectionBySupermarket: SectionBySupermarket
    ): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);
      const normalizedSections = normalizeSectionMap(normalizedMarkets, sectionBySupermarket);

      if (!normalizedName) {
        return { success: false, message: "Please enter a product name." };
      }

      if (normalizedMarkets.length === 0) {
        return { success: false, message: "Select at least one supermarket." };
      }

      const hasConflict = templates.some(
        (template) => template.id !== id && equalsIgnoreCase(template.name, normalizedName)
      );
      if (hasConflict) {
        return { success: false, message: "Another database item already has that name." };
      }

      for (const market of normalizedMarkets) {
        const sectionName = normalizedSections[market];
        if (sectionName) {
          await syncSectionIntoStore(market, sectionName);
        }
      }

      if (syncMode === "local" || !supabase) {
        setTemplates((current) =>
          current.map((template) =>
            template.id === id
              ? {
                  ...template,
                  name: normalizedName,
                  supermarkets: normalizedMarkets,
                  sectionBySupermarket: normalizedSections
                }
              : template
          )
        );
        return { success: true, message: "Database item updated." };
      }

      const { error } = await supabase
        .from("templates")
        .update({
          name: normalizedName,
          supermarkets: normalizedMarkets,
          section_by_supermarket: normalizedSections
        })
        .eq("id", id);

      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Database item updated." };
    },
    [refreshFromCloud, syncMode, syncSectionIntoStore, templates]
  );

  const deleteTemplate = useCallback(
    async (id: string): Promise<ActionResult> => {
      const existing = templates.find((template) => template.id === id);
      if (!existing) {
        return { success: false, message: "Database item not found." };
      }

      if (syncMode === "local" || !supabase) {
        setTemplates((current) => current.filter((template) => template.id !== id));
        return { success: true, message: "Database item deleted." };
      }

      const { error } = await supabase.from("templates").delete().eq("id", id);
      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Database item deleted." };
    },
    [refreshFromCloud, syncMode, templates]
  );

  const openAddModal = useCallback(() => setIsAddModalOpen(true), []);
  const closeAddModal = useCallback(() => setIsAddModalOpen(false), []);

  const value = useMemo(
    () => ({
      products,
      supermarkets,
      sectionsBySupermarket,
      templates,
      filteredProducts,
      searchTerm,
      selectedSupermarket,
      statusFilter,
      isAddModalOpen,
      isHydrated,
      syncMode,
      syncError,
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
      addSectionToSupermarket,
      renameSectionInSupermarket,
      moveSectionInSupermarket,
      deleteSectionFromSupermarket,
      editTemplate,
      deleteTemplate
    }),
    [
      products,
      supermarkets,
      sectionsBySupermarket,
      templates,
      filteredProducts,
      searchTerm,
      selectedSupermarket,
      statusFilter,
      isAddModalOpen,
      isHydrated,
      syncMode,
      syncError,
      openAddModal,
      closeAddModal,
      addProduct,
      editProduct,
      deleteProduct,
      toggleProductBought,
      addSupermarket,
      editSupermarket,
      deleteSupermarket,
      addSectionToSupermarket,
      renameSectionInSupermarket,
      moveSectionInSupermarket,
      deleteSectionFromSupermarket,
      editTemplate,
      deleteTemplate
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
