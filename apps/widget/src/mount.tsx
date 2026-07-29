import { createRoot, type Root } from "react-dom/client";
import cssText from "./styles/widget.css?inline";
import { Widget } from "./Widget.js";

/** Mounts the widget into a Shadow DOM under `container`, so its styles never
 * leak into (or get overridden by) the host page's Divi/theme CSS. */
export function mountWidget(container: HTMLElement, apiUrl: string): Root {
  const shadow = container.shadowRoot ?? container.attachShadow({ mode: "open" });
  shadow.innerHTML = "";

  const style = document.createElement("style");
  style.textContent = cssText;
  shadow.appendChild(style);

  const mountPoint = document.createElement("div");
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<Widget apiUrl={apiUrl} />);
  return root;
}
