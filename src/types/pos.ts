export type ProductVariantChoice = {
  name: string;
  price: number;
  stock_id?: string;
};

export type ProductVariant = {
  name: string;
  is_required: boolean;
  is_multiple?: boolean;
  choices: ProductVariantChoice[];
};

export type Product = {
  id: string;
  category_id: string;
  name: string;
  price: number;
  image_url: string;
  is_available: boolean;
  is_titipan: boolean;
  titipan_name: string | null;
  supplier_price?: number;
  is_quick?: boolean;
  stock?: number;
  variants?: ProductVariant[];
};

export type Category = {
  id: string;
  name: string;
};

export type CartItem = {
  id: string;
  product: Product;
  quantity: number;
  notes?: string;
  variantChoices?: Record<string, string[]>;
  isExistingPaid?: boolean;
};
