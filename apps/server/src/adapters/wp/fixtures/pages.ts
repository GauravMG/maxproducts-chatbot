import type { SitePageRecord } from "../types.js";

// Fixture site content modeled on maxpowereu.com's real page structure, for the
// informational Q&A full-text search demo. In WP_MODE=live this table is instead
// populated by crawling/exporting the real WP pages/posts via `pnpm sync:pages`.
export const PAGE_FIXTURES: SitePageRecord[] = [
  {
    url: "https://maxpowereu.com/",
    title: "Max Power Europe — Cordless Power Tools, EV Charging & Garden Equipment",
    excerpt:
      "Max Power Europe supplies professional cordless power tools, EV charging solutions, electric UTVs, scooters and garden equipment to trade and retail customers across Europe.",
    content:
      "Max Power Europe is a specialist retailer and dealer of cordless power tools, EV charging equipment, electric UTVs, electric scooters and bicycles, and renewable energy products. Our shop covers Cordless Power Tools, Cordless Combo Kits, Grinding & Sanding & Polishing, Concrete & Masonry Tools, Drills & Fastening, Saws & Cutters, and Planing & Cutting. We stock trusted brands including Makita, DeWalt, Bosch, Milwaukee and Hilti. We offer multiple secure payment methods and support both retail and trade/dealer accounts through our My Account portal.",
    source: "wp_page",
  },
  {
    url: "https://maxpowereu.com/about-us/",
    title: "About Us",
    excerpt: "Learn about Max Power Europe, our mission and our commitment to quality tools and renewable energy equipment.",
    content:
      "Max Power Europe was founded to bring professional-grade cordless power tools and next-generation electric mobility and energy products to European trade and retail customers. We work directly with leading manufacturers to offer competitive pricing, genuine warranty support, and fast dispatch on every order. Our team includes trade specialists who can help dealers select the right combo kits and fleet equipment for their business.",
    source: "wp_page",
  },
  {
    url: "https://maxpowereu.com/contact-us/",
    title: "Contact Us",
    excerpt: "Get in touch with the Max Power Europe team for sales, support, or trade/dealer account enquiries.",
    content:
      "You can reach Max Power Europe by phone, email, or the contact form on this page. For trade and dealer account enquiries, including setting up a dealer portal login, please contact our sales team directly. Our support hours and response times are listed here, along with our registered business address.",
    source: "wp_page",
  },
  {
    url: "https://maxpowereu.com/my-account/",
    title: "My Account",
    excerpt: "Log in or register to manage your Max Power Europe account, orders, addresses and invoices.",
    content:
      "The My Account area lets registered customers and dealers log in to view order history, download invoices, and update billing and shipping addresses and account details. New customers can register for an account from this page. Dealers with a trade account use the same login to access their dealer pricing and order history.",
    source: "wp_page",
  },
  {
    url: "https://maxpowereu.com/shop/",
    title: "Shop — All Products",
    excerpt: "Browse the full Max Power Europe catalogue: cordless power tools, combo kits, EV charging, garden equipment and more.",
    content:
      "Our shop is organised into the following categories: Cordless Power Tools, Cordless Combo Kit, Grinding, Sanding & Polishing, Concrete & Masonry Tools, Drills & Fastening, Saws & Cutters, Planing & Cutting, EV Charging, Garden Equipment, and Batteries & Chargers. Use the category filters or search to find the right tool for your job, or chat with our assistant to narrow down options by brand, voltage, or price.",
    source: "woo_shop",
  },
  {
    url: "https://maxpowereu.com/product-category/cordless-power-tools/",
    title: "Cordless Power Tools",
    excerpt: "Professional cordless power tools from Makita, DeWalt, Bosch and Milwaukee.",
    content:
      "Our Cordless Power Tools category includes impact drivers, angle grinders, reciprocating saws, rotary hammers and multi-tools in 18V and 36V platforms from Makita, DeWalt, Bosch and Milwaukee. Many models are compatible across combo kits within the same battery platform.",
    source: "woo_category",
  },
  {
    url: "https://maxpowereu.com/product-category/ev-charging/",
    title: "EV Charging",
    excerpt: "Home and commercial EV charging solutions including 7kW and 22kW chargers.",
    content:
      "Our EV Charging range includes 7kW home chargers, 22kW commercial chargers, portable charging cables and smart charging controllers, suitable for residential installation or commercial fleet charging.",
    source: "woo_category",
  },
  {
    url: "https://maxpowereu.com/shipping-returns/",
    title: "Shipping & Returns Policy",
    excerpt: "Information on delivery times, shipping costs, and our returns and warranty policy.",
    content:
      "Max Power Europe ships across the EU with standard delivery typically taking 2-5 business days. Returns are accepted within 30 days of delivery for unused items in original packaging. All power tools carry manufacturer warranty, and dealers benefit from extended trade warranty terms. For a return, log in to My Account, locate the order, and start a return request, or contact support with your order number.",
    source: "wp_page",
  },
  {
    url: "https://maxpowereu.com/blog/choosing-the-right-cordless-platform/",
    title: "Blog: Choosing the Right Cordless Platform",
    excerpt: "A guide to picking between 12V, 18V and 36V cordless tool platforms for trade and DIY use.",
    content:
      "When choosing a cordless power tool platform, consider the balance of power, weight and battery runtime. 12V tools are lightweight and suited to precision work like screwdriving. 18V is the most versatile platform, covering everything from drills to grinders to saws, and offers the widest range of combo kits. 36V (or dual-18V) platforms are best for high-demand tools like rotary hammers and mitre saws. Standardising on one battery platform across your toolkit reduces the number of chargers and batteries you need to carry.",
    source: "wp_post",
  },
  {
    url: "https://maxpowereu.com/blog/ev-charger-installation-basics/",
    title: "Blog: EV Charger Installation Basics",
    excerpt: "What to know before installing a home or commercial EV charging point.",
    content:
      "Before installing an EV charger, confirm your property's electrical capacity, decide between a 7kW single-phase home charger or a 22kW three-phase commercial unit, and check whether a smart charging controller is required for load balancing. Installation should always be carried out by a qualified electrician, and Max Power Europe's EV Charging range includes options suitable for both domestic driveways and commercial fleet depots.",
    source: "wp_post",
  },
];
