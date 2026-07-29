import { mountWidget } from "./mount.js";

const apiUrl = import.meta.env.VITE_CHATBOT_API_URL || "http://localhost:4000";
const container = document.getElementById("mpe-chatbot-root");

if (container) {
  mountWidget(container, apiUrl);
} else {
  console.error("mpe-chatbot: #mpe-chatbot-root not found in demo.html");
}
