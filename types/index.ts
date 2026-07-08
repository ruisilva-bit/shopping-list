export type SectionBySupermarket = Record<string, string | null>;

export type Product = {
  id: string;
  name: string;
  supermarkets: string[];
  sectionBySupermarket: SectionBySupermarket;
  isBought: boolean;
  boughtAt: string | null;
};

export type ProductTemplate = {
  id: string;
  name: string;
  supermarkets: string[];
  sectionBySupermarket: SectionBySupermarket;
  purchaseLog: string[];
};

export type PurchaseContext = {
  supermarket?: string | null;
  sectionName?: string | null;
};

export type MoveDirection = "up" | "down";

export type ActionResult = {
  success: boolean;
  message: string;
};
