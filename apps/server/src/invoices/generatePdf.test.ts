import { describe, expect, it } from "vitest";
import { generateInvoicePdf } from "./generatePdf.js";
import type { InvoiceData } from "../adapters/wp/index.js";

const SAMPLE_INVOICE: InvoiceData = {
  orderId: 5001,
  orderNumber: "MPE-5001",
  dateCreated: new Date().toISOString(),
  currency: "EUR",
  lineItems: [
    { name: "Makita 18V Impact Driver", quantity: 1, total: 220.64, sku: "MPE-1000" },
    { name: "Bosch 18V Reciprocating Saw", quantity: 1, total: 167.91, sku: "MPE-1002" },
  ],
  total: 388.55,
  billing: {
    firstName: "Aidan",
    lastName: "Murphy",
    company: "Murphy Tools & Plant Hire",
    address1: "14 Industrial Estate Road",
    city: "Cork",
    postcode: "T12 XY34",
    country: "IE",
  },
  shipping: {
    firstName: "Aidan",
    lastName: "Murphy",
    company: "Murphy Tools & Plant Hire",
    address1: "14 Industrial Estate Road",
    city: "Cork",
    postcode: "T12 XY34",
    country: "IE",
  },
};

describe("generateInvoicePdf", () => {
  it("produces a well-formed PDF buffer", async () => {
    const pdf = await generateInvoicePdf(SAMPLE_INVOICE);
    expect(pdf).toBeInstanceOf(Buffer);
    expect(pdf.length).toBeGreaterThan(500);
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(pdf.subarray(-6).toString("ascii").trim()).toBe("%%EOF");
  });

  it("handles an order with no line items without throwing", async () => {
    const pdf = await generateInvoicePdf({ ...SAMPLE_INVOICE, lineItems: [], total: 0 });
    expect(pdf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });
});
