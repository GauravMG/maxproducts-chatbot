import type { AccountDetails, Address, OrderDetail } from "@mpe-chatbot/shared";
import { PRODUCT_FIXTURES } from "./products.js";

export interface MockCustomer {
  userId: number;
  email: string;
  name: string;
  account: AccountDetails;
  billing: Address;
  shipping: Address;
  orders: OrderDetail[];
}

function order(
  id: number,
  number: string,
  status: string,
  daysAgo: number,
  productIdx: number[],
  billing: Address,
  shipping: Address
): OrderDetail {
  const lineItems = productIdx.map((idx) => {
    const p = PRODUCT_FIXTURES[idx];
    const quantity = 1 + (idx % 2);
    return { name: p.name, quantity, total: Math.round(p.price * quantity * 100) / 100, sku: p.sku };
  });
  const total = Math.round(lineItems.reduce((sum, li) => sum + li.total, 0) * 100) / 100;
  const dateCreated = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString();

  return {
    id,
    number,
    status,
    total,
    currency: "EUR",
    dateCreated,
    itemsSummary: lineItems.map((li) => `${li.quantity}x ${li.name}`).join(", "),
    lineItems,
    billing,
    shipping,
    paymentMethodTitle: "Credit Card",
  };
}

const DEALER_ONE_BILLING: Address = {
  firstName: "Aidan",
  lastName: "Murphy",
  company: "Murphy Tools & Plant Hire",
  address1: "14 Industrial Estate Road",
  city: "Cork",
  postcode: "T12 XY34",
  country: "IE",
  phone: "+353 21 555 0142",
};

const DEALER_ONE_SHIPPING: Address = { ...DEALER_ONE_BILLING };

const DEALER_TWO_BILLING: Address = {
  firstName: "Freya",
  lastName: "Nilsen",
  company: "Nilsen Bygg AS",
  address1: "Storgata 22",
  city: "Oslo",
  postcode: "0184",
  country: "NO",
  phone: "+47 22 555 0199",
};

const DEALER_TWO_SHIPPING: Address = {
  ...DEALER_TWO_BILLING,
  address1: "Lagerveien 5, Warehouse 3",
  city: "Oslo",
};

export const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    userId: 101,
    email: "aidan@murphytools.example",
    name: "Aidan Murphy",
    account: {
      firstName: "Aidan",
      lastName: "Murphy",
      email: "aidan@murphytools.example",
      phone: "+353 21 555 0142",
    },
    billing: DEALER_ONE_BILLING,
    shipping: DEALER_ONE_SHIPPING,
    orders: [
      order(5001, "MPE-5001", "completed", 3, [0, 12], DEALER_ONE_BILLING, DEALER_ONE_SHIPPING),
      order(5002, "MPE-5002", "processing", 20, [24], DEALER_ONE_BILLING, DEALER_ONE_SHIPPING),
      order(5003, "MPE-5003", "completed", 65, [40, 41, 42], DEALER_ONE_BILLING, DEALER_ONE_SHIPPING),
    ],
  },
  {
    userId: 102,
    email: "freya@nilsenbygg.example",
    name: "Freya Nilsen",
    account: {
      firstName: "Freya",
      lastName: "Nilsen",
      email: "freya@nilsenbygg.example",
      phone: "+47 22 555 0199",
    },
    billing: DEALER_TWO_BILLING,
    shipping: DEALER_TWO_SHIPPING,
    orders: [
      order(6001, "MPE-6001", "completed", 10, [70, 71], DEALER_TWO_BILLING, DEALER_TWO_SHIPPING),
      order(6002, "MPE-6002", "on-hold", 1, [90], DEALER_TWO_BILLING, DEALER_TWO_SHIPPING),
    ],
  },
];

export function findMockCustomer(userId: number): MockCustomer | undefined {
  return MOCK_CUSTOMERS.find((c) => c.userId === userId);
}
