import PDFDocument from "pdfkit";
import type { InvoiceData } from "../adapters/wp/index.js";

function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", { style: "currency", currency }).format(amount);
}

function formatAddress(a: InvoiceData["billing"]): string[] {
  return [
    `${a.firstName} ${a.lastName}`,
    a.company,
    a.address1,
    a.address2,
    [a.city, a.postcode].filter(Boolean).join(" "),
    a.country,
  ].filter((line): line is string => Boolean(line));
}

/** Renders an invoice PDF from order data into a Buffer. Used by the backend_pdf invoice strategy. */
export function generateInvoicePdf(invoice: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.fontSize(20).text("Max Power Europe", { continued: false });
    doc.fontSize(10).fillColor("#555").text("https://maxpowereu.com");
    doc.moveDown(1.5);

    doc.fillColor("#000").fontSize(16).text(`Invoice ${invoice.orderNumber}`);
    doc
      .fontSize(10)
      .fillColor("#555")
      .text(`Order date: ${new Date(invoice.dateCreated).toLocaleDateString("en-IE")}`);
    doc.moveDown(1);

    const colTop = doc.y;
    doc.fillColor("#000").fontSize(11).text("Billing Address", 50, colTop);
    doc.fontSize(10).fillColor("#333").text(formatAddress(invoice.billing).join("\n"), 50, doc.y + 2);

    doc.fillColor("#000").fontSize(11).text("Shipping Address", 300, colTop);
    doc.fontSize(10).fillColor("#333").text(formatAddress(invoice.shipping).join("\n"), 300, colTop + 15);

    doc.moveDown(2);
    doc.x = 50;

    const tableTop = doc.y;
    doc.fontSize(10).fillColor("#000");
    doc.text("Item", 50, tableTop, { width: 260, continued: false });
    doc.text("Qty", 320, tableTop, { width: 60 });
    doc.text("Total", 400, tableTop, { width: 100, align: "right" });
    doc
      .moveTo(50, tableTop + 15)
      .lineTo(500, tableTop + 15)
      .strokeColor("#ccc")
      .stroke();

    let y = tableTop + 22;
    for (const item of invoice.lineItems) {
      doc.fontSize(10).fillColor("#333");
      doc.text(item.name, 50, y, { width: 260 });
      doc.text(String(item.quantity), 320, y, { width: 60 });
      doc.text(formatMoney(item.total, invoice.currency), 400, y, { width: 100, align: "right" });
      y += 20;
    }

    doc
      .moveTo(50, y + 4)
      .lineTo(500, y + 4)
      .strokeColor("#ccc")
      .stroke();
    doc
      .fontSize(12)
      .fillColor("#000")
      .text(`Total: ${formatMoney(invoice.total, invoice.currency)}`, 300, y + 14, {
        width: 200,
        align: "right",
      });

    doc.moveDown(4);
    doc
      .fontSize(9)
      .fillColor("#888")
      .text("Thank you for your business. For questions about this invoice, contact support@maxpowereu.com.", 50, doc.y, {
        width: 450,
      });

    doc.end();
  });
}
