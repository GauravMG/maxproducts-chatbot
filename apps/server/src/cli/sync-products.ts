import { syncProducts } from "../sync/syncProducts.js";

syncProducts()
  .then(({ count }) => {
    console.log(`Synced ${count} products into ProductCache.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Product sync failed:", err);
    process.exit(1);
  });
