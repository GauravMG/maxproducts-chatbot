import { syncPages } from "../sync/syncPages.js";

syncPages()
  .then(({ count }) => {
    console.log(`Synced ${count} pages into SitePage.`);
    process.exit(0);
  })
  .catch((err) => {
    console.error("Page sync failed:", err);
    process.exit(1);
  });
