import type { ProductRecord } from "../types.js";

// Realistic fixture catalog modeled on maxpowereu.com's real taxonomy, generated
// programmatically so guided product-narrowing has enough volume/variety to be
// meaningful (varied brand/voltage/price per category) without hand-typing ~150 SKUs.

interface CategorySpec {
  name: string;
  brands: string[];
  itemNames: string[];
  voltages?: string[];
  powerSource: "Cordless" | "Corded" | "Electric" | "Petrol";
  priceRange: [number, number];
}

const CATEGORY_SPECS: CategorySpec[] = [
  {
    name: "Cordless Power Tools",
    brands: ["Makita", "DeWalt", "Bosch", "Milwaukee"],
    itemNames: ["Impact Driver", "Angle Grinder", "Reciprocating Saw", "Rotary Hammer", "Multi-Tool"],
    voltages: ["18V", "36V"],
    powerSource: "Cordless",
    priceRange: [79, 349],
  },
  {
    name: "Cordless Combo Kit",
    brands: ["Makita", "DeWalt", "Milwaukee"],
    itemNames: ["2-Piece Combo Kit", "3-Piece Combo Kit", "5-Piece Combo Kit"],
    voltages: ["18V"],
    powerSource: "Cordless",
    priceRange: [199, 699],
  },
  {
    name: "Grinding, Sanding & Polishing",
    brands: ["Bosch", "Makita", "Metabo"],
    itemNames: ["Angle Grinder", "Orbital Sander", "Belt Sander", "Polisher", "Die Grinder"],
    voltages: ["18V", "Corded"],
    powerSource: "Cordless",
    priceRange: [59, 289],
  },
  {
    name: "Concrete & Masonry Tools",
    brands: ["Bosch", "Hilti", "Makita"],
    itemNames: ["SDS-Plus Rotary Hammer", "Demolition Hammer", "Core Drill", "Concrete Vibrator"],
    voltages: ["Corded", "36V"],
    powerSource: "Corded",
    priceRange: [149, 899],
  },
  {
    name: "Drills & Fastening",
    brands: ["Makita", "DeWalt", "Bosch", "Ryobi"],
    itemNames: ["Combi Drill", "Impact Wrench", "Screwdriver", "Hammer Drill"],
    voltages: ["12V", "18V"],
    powerSource: "Cordless",
    priceRange: [49, 259],
  },
  {
    name: "Saws & Cutters",
    brands: ["Makita", "DeWalt", "Bosch"],
    itemNames: ["Circular Saw", "Jigsaw", "Mitre Saw", "Chainsaw", "Metal Cutter"],
    voltages: ["18V", "Corded"],
    powerSource: "Cordless",
    priceRange: [69, 449],
  },
  {
    name: "Planing & Cutting",
    brands: ["Makita", "Bosch"],
    itemNames: ["Electric Planer", "Router", "Biscuit Jointer"],
    voltages: ["Corded", "18V"],
    powerSource: "Corded",
    priceRange: [89, 329],
  },
  {
    name: "EV Charging",
    brands: ["MaxPower", "Wallbox", "Zappi"],
    itemNames: ["7kW Home Charger", "22kW Commercial Charger", "Portable EV Charging Cable", "Smart Charging Controller"],
    powerSource: "Electric",
    priceRange: [249, 1299],
  },
  {
    name: "Garden Equipment",
    brands: ["MaxPower", "Makita", "Ryobi"],
    itemNames: ["Cordless Lawn Mower", "Hedge Trimmer", "Leaf Blower", "Chainsaw", "Grass Trimmer"],
    voltages: ["36V", "40V"],
    powerSource: "Cordless",
    priceRange: [99, 599],
  },
  {
    name: "Batteries & Chargers",
    brands: ["Makita", "DeWalt", "Bosch", "MaxPower"],
    itemNames: ["Battery Pack", "Fast Charger", "Dual Port Charger", "Battery Adapter"],
    voltages: ["18V", "36V"],
    powerSource: "Cordless",
    priceRange: [29, 179],
  },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function buildCatalog(): ProductRecord[] {
  const rand = seededRandom(42);
  const products: ProductRecord[] = [];
  let id = 1000;

  for (const spec of CATEGORY_SPECS) {
    for (const brand of spec.brands) {
      for (const itemName of spec.itemNames) {
        const voltage = spec.voltages
          ? spec.voltages[Math.floor(rand() * spec.voltages.length)]
          : undefined;
        const name = voltage
          ? `${brand} ${voltage} ${itemName}`
          : `${brand} ${itemName}`;
        const slug = slugify(`${brand}-${itemName}-${voltage ?? ""}-${id}`);
        const [minP, maxP] = spec.priceRange;
        const price = Math.round((minP + rand() * (maxP - minP)) * 100) / 100;
        const onSale = rand() < 0.2;
        const regularPrice = onSale ? Math.round(price * 1.15 * 100) / 100 : price;

        products.push({
          id,
          slug,
          name,
          sku: `MPE-${id}`,
          price,
          regularPrice,
          salePrice: onSale ? price : undefined,
          currency: "EUR",
          category: spec.name,
          categories: [spec.name],
          attributes: {
            brand,
            ...(voltage ? { voltage } : {}),
            powerSource: spec.powerSource,
          },
          stockStatus: rand() < 0.9 ? "instock" : "outofstock",
          permalink: `https://maxpowereu.com/product/${slug}/`,
          imageUrl: `https://maxpowereu.com/wp-content/uploads/products/${slug}.jpg`,
          description: `The ${name} delivers professional-grade performance for trade and DIY use alike. Part of the ${spec.name} range at Max Power Europe, built for durability and everyday reliability on the jobsite.`,
          shortDescription: `${brand} ${itemName}${voltage ? ` (${voltage})` : ""} — ${spec.name}.`,
        });
        id += 1;
      }
    }
  }

  return products;
}

export const PRODUCT_FIXTURES: ProductRecord[] = buildCatalog();
