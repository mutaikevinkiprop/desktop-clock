/**
 * Font choices offered by the application.
 *
 * All families fall back to system fonts so the clock renders correctly even
 * when a webfont is unavailable (offline-first, no network requests).
 * The "digital", "inter", "roboto", "jetbrains-mono" and "orbitron" entries
 * deliberately degrade to installed system fonts / monospace rather than
 * fetching anything from the network.
 */

export interface FontOption {
  id: string;
  name: string;
  /** Full CSS font-family stack. */
  stack: string;
  /** Preview style shown in the picker. */
  preview: string;
}

export const FONTS: FontOption[] = [
  {
    id: "system-sans",
    name: "System Sans",
    stack:
      '"Segoe UI Variable Display", "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif',
    preview: "12:34",
  },
  {
    id: "inter",
    name: "Inter",
    stack:
      'Inter, "Segoe UI Variable Text", "Segoe UI", system-ui, -apple-system, Arial, sans-serif',
    preview: "12:34",
  },
  {
    id: "roboto",
    name: "Roboto",
    stack: 'Roboto, "Segoe UI", system-ui, -apple-system, Arial, sans-serif',
    preview: "12:34",
  },
  {
    id: "jetbrains-mono",
    name: "JetBrains Mono",
    stack:
      '"JetBrains Mono", "Cascadia Mono", "Cascadia Code", Consolas, "SF Mono", monospace',
    preview: "12:34",
  },
  {
    id: "monospace",
    name: "Monospace",
    stack: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    preview: "12:34",
  },
  {
    id: "digital",
    name: "Digital",
    stack:
      '"DS-Digital", "Digital-7", "Segment7", "Cascadia Mono", Consolas, monospace',
    preview: "12:34",
  },
  {
    id: "orbitron",
    name: "Orbitron",
    stack: 'Orbitron, "Cascadia Mono", Consolas, monospace',
    preview: "12:34",
  },
];

export function getFontStack(id: string): string {
  const font = FONTS.find((f) => f.id === id);
  return font?.stack ?? FONTS[0]!.stack;
}