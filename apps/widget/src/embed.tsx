import { mountWidget } from "./mount.js";

export interface MpeChatbotInitOptions {
  /** Base URL of the mpe-chatbot Express API, e.g. https://chatbot-api.example.com */
  apiUrl: string;
}

let initialized = false;

function mount(options: MpeChatbotInitOptions): void {
  const container = document.createElement("div");
  container.id = "mpe-chatbot-widget-container";
  document.body.appendChild(container);
  mountWidget(container, options.apiUrl);
}

function init(options: MpeChatbotInitOptions): void {
  if (initialized) return;
  initialized = true;

  // init() can run before <body> exists yet — e.g. a plain (non-defer/async) <script>
  // placed in <head>, which is a common way site builders (Divi included) let you
  // inject "head code". Wait for the DOM to be ready before touching document.body.
  if (document.body) {
    mount(options);
  } else {
    document.addEventListener("DOMContentLoaded", () => mount(options), { once: true });
  }
}

declare global {
  interface Window {
    MpeChatbot?: { init: typeof init };
  }
}

window.MpeChatbot = { init };
