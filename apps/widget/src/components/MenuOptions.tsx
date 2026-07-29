import { MENU_OPTIONS, type MenuOption } from "../lib/menuOptions.js";

export function MenuOptions({ onSelect }: { onSelect: (option: MenuOption) => void }) {
  return (
    <div className="mpe-menu">
      <div className="mpe-menu-title">What would you like to do?</div>
      <div className="mpe-menu-grid">
        {MENU_OPTIONS.map((opt) => (
          <button key={opt.mode} className="mpe-menu-option" onClick={() => onSelect(opt)}>
            <span className="mpe-menu-option-icon">{opt.icon}</span>
            <span className="mpe-menu-option-text">
              <span className="mpe-menu-option-label">{opt.label}</span>
              <span className="mpe-menu-option-desc">{opt.description}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
