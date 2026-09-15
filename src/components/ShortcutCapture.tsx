/**
 * ShortcutCapture - a modal that records a key combination.
 *
 * Converts a keyboard event into a Tauri accelerator string such as
 * "Ctrl+Alt+KeyC". Modifier-only presses are ignored, and Escape cancels.
 */

import { useEffect, useState } from "react";

interface ShortcutCaptureProps {
  onCapture: (accelerator: string) => void;
  onCancel: () => void;
}

/** Map KeyboardEvent.code values Tauri understands. */
function normalizeCode(code: string, key: string): string | null {
  if (code.startsWith("Key")) return code;
  if (code.startsWith("Digit")) return code;
  if (code.startsWith("Numpad") || /^F\d{1,2}$/.test(code)) return code;
  const special: Record<string, string> = {
    Space: "Space",
    ArrowUp: "ArrowUp",
    ArrowDown: "ArrowDown",
    ArrowLeft: "ArrowLeft",
    ArrowRight: "ArrowRight",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
    Delete: "Delete",
    Backquote: "Backquote",
    Minus: "Minus",
    Equal: "Equal",
    BracketLeft: "BracketLeft",
    BracketRight: "BracketRight",
    Backslash: "Backslash",
    Semicolon: "Semicolon",
    Quote: "Quote",
    Comma: "Comma",
    Period: "Period",
    Slash: "Slash",
    Enter: "Enter",
    Tab: "Tab",
  };
  if (special[code]) return special[code];
  // Fall back to a single printable character.
  if (key.length === 1) return key.toUpperCase();
  return null;
}

export default function ShortcutCapture({ onCapture, onCancel }: ShortcutCaptureProps) {
  const [preview, setPreview] = useState("Press a key combination…");

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        onCancel();
        return;
      }

      const parts: string[] = [];
      if (event.ctrlKey) parts.push("Ctrl");
      if (event.altKey) parts.push("Alt");
      if (event.shiftKey) parts.push("Shift");
      if (event.metaKey) parts.push("Super");

      const code = normalizeCode(event.code, event.key);
      const isModifierOnly = ["Control", "Alt", "Shift", "Meta"].includes(event.key);

      if (isModifierOnly || !code) {
        const label = parts.length ? parts.join(" + ") + " + …" : preview;
        setPreview(label);
        return;
      }

      // Require at least one modifier so the shortcut is not a bare letter.
      if (parts.length === 0) {
        setPreview("Add a modifier: Ctrl, Alt or Shift");
        return;
      }

      const accelerator = [...parts, code].join("+");
      setPreview(accelerator.replace(/\+/g, " + "));
      onCapture(accelerator);
    };

    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [onCapture, onCancel, preview]);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Record shortcut"
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Record shortcut</h3>
        <p>
          Hold a modifier and press a key. Escape cancels. The combination must
          be unique across Windows.
        </p>
        <div className="shortcut-capture" aria-live="polite">
          {preview}
        </div>
        <div className="modal__actions">
          <button className="ui-button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}