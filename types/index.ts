export type Product = {
  id: string;
  name: string;
  supermarkets: string[];
  isBought: boolean;
  boughtAt: string | null;
};

export type ProductTemplate = {
  id: string;
  name: string;
  supermarkets: string[];
  purchaseLog: string[];
};

export type ActionResult = {
  success: boolean;
  message: string;
};
