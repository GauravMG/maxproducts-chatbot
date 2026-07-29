import { env } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`mpe-chatbot server listening on :${env.PORT} (WP_MODE=${env.WP_MODE}, ENABLE_DEV_AUTH=${env.ENABLE_DEV_AUTH})`);
});
