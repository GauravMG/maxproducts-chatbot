// Domain types shared across the server's WP adapters, tools, and the widget's rendering of action cards.

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state?: string;
  postcode: string;
  country: string;
  phone?: string;
}

export interface AccountDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface ProductAttributes {
  brand?: string;
  voltage?: string;
  powerSource?: string;
  [key: string]: string | undefined;
}

export interface ProductSummary {
  id: number;
  slug: string;
  name: string;
  sku?: string;
  price: number;
  regularPrice?: number;
  salePrice?: number;
  currency: string;
  category: string;
  categories: string[];
  attributes: ProductAttributes;
  stockStatus: "instock" | "outofstock" | "onbackorder";
  permalink: string;
  imageUrl?: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  shortDescription: string;
}

export interface SitePageSummary {
  url: string;
  title: string;
  excerpt: string;
  /** A snippet pulled from the page's actual body content (not just the short WP
   * auto-excerpt) — for a topic search, centered on the matched terms so facts buried
   * deep in a long page (an email address, a policy detail) are visible to the model.
   * Absent for the "no topic given, most recent items" fallback (nothing to center on). */
  contentSnippet?: string;
  score?: number;
}

export interface OrderLineItem {
  name: string;
  quantity: number;
  total: number;
  sku?: string;
}

export interface OrderSummary {
  id: number;
  number: string;
  status: string;
  total: number;
  currency: string;
  dateCreated: string;
  itemsSummary: string;
}

export interface OrderDetail extends OrderSummary {
  lineItems: OrderLineItem[];
  billing: Address;
  shipping: Address;
  paymentMethodTitle?: string;
}

export interface Facet {
  name: string;
  count: number;
}

export interface ProductFacets {
  categories: Facet[];
  brands: Facet[];
  priceRange: { min: number; max: number } | null;
}

export interface WpIdentity {
  userId: number;
  email: string;
  name: string;
}
