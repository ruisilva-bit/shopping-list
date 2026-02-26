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
import { isSupabaseConfigured, ProductRow, supabase, TemplateRow } from "../lib/supabase";
import { ActionResult, Product, ProductTemplate } from "../types";

const DEFAULT_SUPERMARKETS = ["Continente", "Pingo Doce", "Lidl", "Mercadona"];
const PRODUCTS_STORAGE_KEY = "shopping-list-products";
const SUPERMARKETS_STORAGE_KEY = "shopping-list-supermarkets";
const TEMPLATES_STORAGE_KEY = "shopping-list-product-templates";
const ONE_HOUR_MS = 60 * 60 * 1000;

export type ProductStatusFilter = "all" | "active" | "bought";
export type SyncMode = "cloud" | "local";

type ShoppingContextValue = {
  products: Product[];
  supermarkets: string[];
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
  addProduct: (name: string, supermarkets: string[]) => Promise<ActionResult>;
  editProduct: (id: string, name: string, supermarkets: string[]) => Promise<ActionResult>;
  deleteProduct: (id: string) => Promise<void>;
  toggleProductBought: (id: string, isBought: boolean) => Promise<void>;
  addSupermarket: (name: string) => Promise<ActionResult>;
  editSupermarket: (currentName: string, newName: string) => Promise<ActionResult>;
  deleteSupermarket: (name: string) => Promise<ActionResult>;
  editTemplate: (id: string, name: string, supermarkets: string[]) => Promise<ActionResult>;
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

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: sanitizeName(row.name),
    supermarkets: normalizeMarkets(row.supermarkets ?? []),
    isBought: Boolean(row.is_bought),
    boughtAt: row.is_bought ? row.bought_at : null
  };
}

function toTemplate(row: TemplateRow): ProductTemplate {
  return {
    id: row.id,
    name: sanitizeName(row.name),
    supermarkets: normalizeMarkets(row.supermarkets ?? []),
    purchaseLog: Array.isArray(row.purchase_log) ? row.purchase_log : []
  };
}

function sortProducts(products: Product[]) {
  return [...products].sort((a, b) => {
    if (a.isBought === b.isBought) {
      return 0;
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

    const safeProducts = pruneExpiredProducts(
      (Array.isArray(rawProducts) ? rawProducts : []).map((product) => ({
        id: String(product.id),
        name: sanitizeName(String(product.name ?? "")),
        supermarkets: normalizeMarkets(Array.isArray(product.supermarkets) ? product.supermarkets : []),
        isBought: Boolean(product.isBought),
        boughtAt: product.boughtAt ? String(product.boughtAt) : null
      }))
    ).filter((product) => product.id && product.name);

    const safeSupermarkets = normalizeMarkets(
      Array.isArray(rawSupermarkets) ? rawSupermarkets : DEFAULT_SUPERMARKETS
    );

    const safeTemplates = (Array.isArray(rawTemplates) ? rawTemplates : [])
      .map((template) => ({
        id: String(template.id),
        name: sanitizeName(String(template.name ?? "")),
        supermarkets: normalizeMarkets(Array.isArray(template.supermarkets) ? template.supermarkets : []),
        purchaseLog: Array.isArray(template.purchaseLog) ? template.purchaseLog.map(String) : []
      }))
      .filter((template) => template.id && template.name);

    const mergedTemplates = safeProducts.reduce(
      (current, product) => upsertTemplateMarkets(current, product.name, product.supermarkets),
      safeTemplates
    );

    setProducts(sortProducts(safeProducts));
    setSupermarkets(safeSupermarkets.length > 0 ? safeSupermarkets : [...DEFAULT_SUPERMARKETS]);
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

      let nextSupermarkets = normalizeMarkets(
        (supermarketsResponse.data ?? []).map((row) => String((row as { name: unknown }).name))
      );

      if (nextSupermarkets.length === 0) {
        const { error } = await supabase
          .from("supermarkets")
          .upsert(
            DEFAULT_SUPERMARKETS.map((name) => ({ name })),
            { onConflict: "name" }
          );

        if (error) {
          throw error;
        }

        nextSupermarkets = [...DEFAULT_SUPERMARKETS];
      }

      let nextTemplates = (templatesResponse.data ?? []).map((row) => toTemplate(row as TemplateRow));
      const missingTemplates = nextProducts
        .filter((product) => !nextTemplates.some((template) => equalsIgnoreCase(template.name, product.name)))
        .map((product) => ({
          name: product.name,
          supermarkets: product.supermarkets,
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
    localStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
  }, [products, supermarkets, templates, isHydrated, syncMode]);

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
    async (name: string, selectedMarkets: string[]) => {
      if (!supabase) {
        return;
      }

      const existingTemplate = templates.find((template) => equalsIgnoreCase(template.name, name));

      if (!existingTemplate) {
        await supabase.from("templates").insert({
          name,
          supermarkets: selectedMarkets,
          purchase_log: []
        });
        return;
      }

      await supabase
        .from("templates")
        .update({
          name,
          supermarkets: selectedMarkets
        })
        .eq("id", existingTemplate.id);
    },
    [templates]
  );

  const appendTemplateLogCloud = useCallback(
    async (name: string, selectedMarkets: string[], boughtTimestamp: string) => {
      if (!supabase) {
        return;
      }

      const existingTemplate = templates.find((template) => equalsIgnoreCase(template.name, name));

      if (!existingTemplate) {
        await supabase.from("templates").insert({
          name,
          supermarkets: selectedMarkets,
          purchase_log: [boughtTimestamp]
        });
        return;
      }

      await supabase
        .from("templates")
        .update({
          supermarkets: normalizeMarkets([...existingTemplate.supermarkets, ...selectedMarkets]),
          purchase_log: [...existingTemplate.purchaseLog, boughtTimestamp]
        })
        .eq("id", existingTemplate.id);
    },
    [templates]
  );

  const addProduct = useCallback(
    async (name: string, selectedMarkets: string[]): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);

      if (!normalizedName) {
        return { success: false, message: "Please enter a product name." };
      }

      if (normalizedMarkets.length === 0) {
        return { success: false, message: "Select at least one supermarket." };
      }

      if (syncMode === "local" || !supabase) {
        setProducts((current) =>
          sortProducts([
            {
              id: createId(),
              name: normalizedName,
              supermarkets: normalizedMarkets,
              isBought: false,
              boughtAt: null
            },
            ...current
          ])
        );

        setTemplates((current) => upsertTemplateMarkets(current, normalizedName, normalizedMarkets));
        return { success: true, message: `Added "${normalizedName}".` };
      }

      const { error: insertError } = await supabase.from("products").insert({
        id: createId(),
        name: normalizedName,
        supermarkets: normalizedMarkets,
        is_bought: false,
        bought_at: null
      });

      if (insertError) {
        return { success: false, message: insertError.message };
      }

      await upsertTemplateMarketsCloud(normalizedName, normalizedMarkets);
      await refreshFromCloud();
      return { success: true, message: `Added "${normalizedName}".` };
    },
    [refreshFromCloud, syncMode, upsertTemplateMarketsCloud]
  );

  const editProduct = useCallback(
    async (id: string, name: string, selectedMarkets: string[]): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);

      if (!normalizedName) {
        return { success: false, message: "Please enter a product name." };
      }

      if (normalizedMarkets.length === 0) {
        return { success: false, message: "Select at least one supermarket." };
      }

      if (syncMode === "local" || !supabase) {
        setProducts((current) =>
          sortProducts(
            current.map((product) =>
              product.id === id
                ? { ...product, name: normalizedName, supermarkets: normalizedMarkets }
                : product
            )
          )
        );

        setTemplates((current) => upsertTemplateMarkets(current, normalizedName, normalizedMarkets));
        return { success: true, message: "Product updated." };
      }

      const { error: updateError } = await supabase
        .from("products")
        .update({ name: normalizedName, supermarkets: normalizedMarkets })
        .eq("id", id);

      if (updateError) {
        return { success: false, message: updateError.message };
      }

      await upsertTemplateMarketsCloud(normalizedName, normalizedMarkets);
      await refreshFromCloud();
      return { success: true, message: "Product updated." };
    },
    [refreshFromCloud, syncMode, upsertTemplateMarketsCloud]
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
    async (id: string, isBought: boolean) => {
      const boughtTimestamp = new Date().toISOString();

      if (syncMode === "local" || !supabase) {
        let boughtProductName = "";
        let boughtProductMarkets: string[] = [];

        setProducts((current) =>
          sortProducts(
            current.map((product) => {
              if (product.id !== id) {
                return product;
              }

              if (isBought && !product.isBought) {
                boughtProductName = product.name;
                boughtProductMarkets = product.supermarkets;
                return { ...product, isBought: true, boughtAt: boughtTimestamp };
              }

              if (!isBought && product.isBought) {
                return { ...product, isBought: false, boughtAt: null };
              }

              return product;
            })
          )
        );

        if (isBought && boughtProductName) {
          setTemplates((current) =>
            appendTemplateLog(current, boughtProductName, boughtProductMarkets, boughtTimestamp)
          );
        }

        return;
      }

      const targetProduct = products.find((product) => product.id === id);
      if (!targetProduct) {
        return;
      }

      await supabase
        .from("products")
        .update({
          is_bought: isBought,
          bought_at: isBought ? boughtTimestamp : null
        })
        .eq("id", id);

      if (isBought && !targetProduct.isBought) {
        await appendTemplateLogCloud(targetProduct.name, targetProduct.supermarkets, boughtTimestamp);
      }

      await refreshFromCloud();
    },
    [appendTemplateLogCloud, products, refreshFromCloud, syncMode]
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
        return { success: true, message: "Supermarket added successfully." };
      }

      const { error } = await supabase.from("supermarkets").insert({ name: normalizedName });
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
      }

      const client = supabase;
      const impactedProducts = products.filter((product) =>
        product.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
      );
      const impactedTemplates = templates.filter((template) =>
        template.supermarkets.some((market) => equalsIgnoreCase(market, existingName))
      );

      await client.from("supermarkets").update({ name: normalizedNewName }).eq("name", existingName);

      await Promise.all([
        ...impactedProducts.map((product) =>
          client
            .from("products")
            .update({
              supermarkets: normalizeMarkets(
                product.supermarkets.map((market) =>
                  equalsIgnoreCase(market, existingName) ? normalizedNewName : market
                )
              )
            })
            .eq("id", product.id)
        ),
        ...impactedTemplates.map((template) =>
          client
            .from("templates")
            .update({
              supermarkets: normalizeMarkets(
                template.supermarkets.map((market) =>
                  equalsIgnoreCase(market, existingName) ? normalizedNewName : market
                )
              )
            })
            .eq("id", template.id)
        )
      ]);

      if (equalsIgnoreCase(selectedSupermarket, existingName)) {
        setSelectedSupermarket(normalizedNewName);
      }

      await refreshFromCloud();
      return { success: true, message: "Supermarket updated." };
    },
    [products, refreshFromCloud, selectedSupermarket, supermarkets, syncMode, templates]
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
        setProducts((current) =>
          current.map((product) => ({
            ...product,
            supermarkets: product.supermarkets.filter((market) => !equalsIgnoreCase(market, existingName))
          }))
        );
        setTemplates((current) =>
          current.map((template) => ({
            ...template,
            supermarkets: template.supermarkets.filter((market) => !equalsIgnoreCase(market, existingName))
          }))
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
          .map((product) =>
            client
              .from("products")
              .update({
                supermarkets: product.supermarkets.filter((market) => !equalsIgnoreCase(market, existingName))
              })
              .eq("id", product.id)
          ),
        ...templates
          .filter((template) => template.supermarkets.some((market) => equalsIgnoreCase(market, existingName)))
          .map((template) =>
            client
              .from("templates")
              .update({
                supermarkets: template.supermarkets.filter((market) => !equalsIgnoreCase(market, existingName))
              })
              .eq("id", template.id)
          )
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

  const editTemplate = useCallback(
    async (id: string, name: string, selectedMarkets: string[]): Promise<ActionResult> => {
      const normalizedName = sanitizeName(name);
      const normalizedMarkets = normalizeMarkets(selectedMarkets);

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

      if (syncMode === "local" || !supabase) {
        setTemplates((current) =>
          current.map((template) =>
            template.id === id
              ? { ...template, name: normalizedName, supermarkets: normalizedMarkets }
              : template
          )
        );
        return { success: true, message: "Database item updated." };
      }

      const { error } = await supabase
        .from("templates")
        .update({ name: normalizedName, supermarkets: normalizedMarkets })
        .eq("id", id);

      if (error) {
        return { success: false, message: error.message };
      }

      await refreshFromCloud();
      return { success: true, message: "Database item updated." };
    },
    [refreshFromCloud, syncMode, templates]
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
