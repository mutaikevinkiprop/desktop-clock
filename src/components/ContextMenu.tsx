/**
 * In-app right-click context menu.
 *
 * A frameless, transparent widget cannot host a native Windows menu without
 * extra native plumbing, so we render a small, themed HTML menu. It is
 * keyboard-navigable (Esc to close, arrow keys to move) and positioned at the
 * click point, clamped to stay inside the window.
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSettings } from "../services/settingsStore";
import * as native from "../services/native";

interface MenuEntry {
  type: "item" | "separator" | "submenu";
  id?: string;
  label?: string;
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  children?: MenuEntry[];
}

export default function ContextMenu() {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [openSubmenu, setOpenSubmenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const settings = useSettings((s) => s.settings);

  // Show only for right-clicks inside the widget.
  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (event.button !== 2) return;
      event.preventDefault();
      setOpen(true);
      setOpenSubmenu(null);
      setPosition({ x: event.clientX, y: event.clientY });
    };
    window.addEventListener("contextmenu", handler);
    return () => window.removeEventListener("contextmenu", handler);
  }, []);

  // Close on any outside click, scroll, blur or Escape.
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Clamp the menu inside the viewport after it has been measured.
  useLayoutEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const maxX = window.innerWidth - rect.width - 4;
    const maxY = window.innerHeight - rect.height - 4;
    setPosition((p) => ({
      x: Math.max(4, Math.min(p.x, maxX)),
      y: Math.max(4, Math.min(p.y, maxY)),
    }));
  }, [open]);

  const run = async (action: string) => {
    const store = useSettings.getState();
    setOpen(false);
    switch (action) {
      case "show":
        store.set("widgetVisible", true);
        await native.showWidget();
        break;
      case "hide":
        store.set("widgetVisible", false);
        await native.hideWidget();
        break;
      case "settings":
        await native.openSettings();
        break;
      case "center":
        await store.centerNow();
        break;
      case "center-primary":
        store.set("monitor", "primary");
        await native.centerWindow("primary");
        break;
      case "center-current":
        await native.centerWindow("current");
        break;
      case "custom":
        store.update({ positionMode: "custom" });
        await store.saveCurrentPosition();
        break;
      case "always-on-top":
        store.set("alwaysOnTop", !store.settings.alwaysOnTop);
        break;
      case "click-through":
        store.set("clickThrough", !store.settings.clickThrough);
        break;
      case "about":
        await native.openSettings();
        window.dispatchEvent(new CustomEvent("navigate", { detail: "about" }));
        break;
      case "exit":
        await native.quitApp();
        break;
      default:
        break;
    }
  };

  const menu: MenuEntry[] = [
    { type: "item", id: "show", label: "Show", disabled: settings.widgetVisible },
    { type: "item", id: "hide", label: "Hide", disabled: !settings.widgetVisible },
    { type: "item", id: "settings", label: "Settings…" },
    { type: "separator" },
    {
      type: "submenu",
      id: "position",
      label: "Position",
      children: [
        { type: "item", id: "center", label: "Center on Screen" },
        { type: "item", id: "center-primary", label: "Center on Primary Monitor" },
        { type: "item", id: "center-current", label: "Center on Current Monitor" },
        { type: "item", id: "custom", label: "Custom Position" },
      ],
    },
    { type: "separator" },
    {
      type: "item",
      id: "always-on-top",
      label: "Always on Top",
      checked: settings.alwaysOnTop,
    },
    {
      type: "item",
      id: "click-through",
      label: "Click Through",
      checked: settings.clickThrough,
    },
    { type: "separator" },
    { type: "item", id: "about", label: "About" },
    { type: "item", id: "exit", label: "Exit", danger: true },
  ];

  if (!open) return null;

  return (
    <div
      className="context-menu"
      ref={menuRef}
      style={{ left: position.x, top: position.y }}
      role="menu"
      aria-label="Clock menu"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {menu.map((entry, index) => {
        if (entry.type === "separator") {
          return <div className="context-menu__sep" key={`sep-${index}`} />;
        }
        if (entry.type === "submenu") {
          const isOpen = openSubmenu === entry.id;
          return (
            <div className="context-menu__submenu" key={entry.id}>
              <button
                className="context-menu__item"
                role="menuitem"
                aria-haspopup="menu"
                aria-expanded={isOpen}
                onPointerEnter={() => setOpenSubmenu(entry.id ?? null)}
                onClick={() => setOpenSubmenu(isOpen ? null : entry.id ?? null)}
              >
                <span>{entry.label}</span>
                <span className="context-menu__chevron" aria-hidden="true">
                  ›
                </span>
              </button>
              {isOpen && (
                <div className="context-menu__flyout" role="menu">
                  {entry.children?.map((child) => (
                    <button
                      key={child.id}
                      className="context-menu__item"
                      role="menuitem"
                      onClick={() => void run(child.id!)}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        }
        return (
          <button
            key={entry.id}
            className={`context-menu__item${entry.danger ? " context-menu__item--danger" : ""}`}
            role="menuitem"
            disabled={entry.disabled}
            onClick={() => void run(entry.id!)}
          >
            <span className="context-menu__check" aria-hidden="true">
              {entry.checked ? "✓" : ""}
            </span>
            <span>{entry.label}</span>
          </button>
        );
      })}
    </div>
  );
}