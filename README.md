# Desktop Clock

A lightweight, beautiful digital clock widget for Windows. Fully customizable with multiple timezone support, precise multi-monitor positioning, and system-tray control.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Platform: Windows](https://img.shields.io/badge/Platform-Windows-blue.svg)
![Version: 1.0.0](https://img.shields.io/badge/Version-1.0.0-green.svg)

## ✨ Features

- **⏰ Real-time clock** — Shows current time with high precision
- **🌍 Multiple timezones** — Add and display multiple timezone clocks
- **🎨 Highly customizable** — Font families, sizes, colors, themes (light/dark/custom)
- **📍 Smart positioning** — Center on any monitor with a global hotkey
- **⌨️ Global hotkey support** — Quickly center or toggle visibility from anywhere
- **🔧 Full settings UI** — Easy-to-use settings window for all options
- **🚀 Launch at startup** (optional) — User-controlled auto-start
- **💾 Lightweight** — ~3.6 MB application + bundled WebView2 runtime
- **🔒 Privacy-first** — No data collection, no network calls, no ads

## 🎯 Use Cases

- **Desk setup** — Display time prominently on your desktop
- **Trading/monitoring** — Keep precise time visible during work
- **Multi-timezone work** — Show times for colleagues in different zones
- **Minimalist setup** — Clean, distraction-free time display

## 📥 Download

**[Get the latest release](https://github.com/mutaikevinkiprop/desktop-clock/releases/latest)**

Choose one installer:

### Windows Installer (Recommended)
```
Desktop Clock_1.0.0_x64_en-US.msi
```
Standard Windows MSI — integrates with Windows Add/Remove Programs.

### NSIS Setup (Alternative)
```
Desktop Clock_1.0.0_x64-setup.exe
```
Lightweight NSIS installer.

**Both installers:**
- ✅ Per-user installation (no admin required)
- ✅ ~200 MB total size (includes WebView2 runtime)
- ✅ Silent mode support for automation
- ✅ Full uninstall capability

## 🚀 Quick Start

### Installation

1. Download the installer from [Releases](https://github.com/mutaikevinkiprop/desktop-clock/releases/latest)
2. Run the `.msi` or `.exe` file
3. Follow the installer prompts
4. Desktop Clock launches automatically

### First Run

1. A clock widget appears on your desktop (centered, 520×200 px by default)
2. Right-click the **system tray icon** (bottom-right taskbar) to open the menu
3. Choose **Settings** to customize

### Basic Operations

| Action | How |
|--------|-----|
| **Move clock** | Drag the clock widget anywhere |
| **Resize clock** | Hover over edges/corners, drag resize handles |
| **Center on monitor** | Right-click tray → Center on Screen (or press your hotkey) |
| **Toggle visibility** | Left-click the tray icon |
| **Open settings** | Right-click tray → Settings |
| **Exit app** | Right-click tray → Exit |

## ⚙️ Settings

### Appearance

- **Font family** — Choose from system fonts
- **Font size** — 12px to 144px (auto-scales to fit widget)
- **Text color** — Any RGB color
- **Background color** — Any RGB color with transparency
- **Theme preset** — Light, Dark, Minimalist, or custom

### Positioning

- **Multi-monitor support** — Center on specific monitor or primary display
- **Always on top** — Keep clock above other windows
- **Click-through mode** — Make clock transparent to mouse clicks
- **Auto-center at startup** — Optional

### Time & Zones

- **Primary timezone** — System timezone or custom
- **Additional timezones** — Add up to 10 custom timezone clocks
- **Format** — 12-hour or 24-hour display

### Behavior

- **Launch at startup** — Enable/disable auto-start (user-controlled)
- **Global hotkey** — Set custom keyboard shortcut for centering
- **Target monitor** — Which monitor the hotkey centers on

## 💻 System Requirements

| Requirement | Details |
|---|---|
| **OS** | Windows 10 (build 1809) or later, Windows 11 |
| **Architecture** | x64 (Intel/AMD) |
| **Disk space** | ~200 MB (includes WebView2 runtime) |
| **Display** | Single or multiple monitors |
| **Memory** | ~30 MB typical |

## 🔒 Privacy & Security

**Desktop Clock respects your privacy:**

- ✅ **No data collection** — Your settings stay on your device
- ✅ **No network calls** — App never connects to the internet
- ✅ **No telemetry** — No usage tracking or analytics
- ✅ **No ads** — Completely ad-free
- ✅ **Open source** — Source code is on GitHub for inspection
- ✅ **Local storage only** — All settings in `%APPDATA%\Desktop Clock`

### What's Stored Locally?

- Window position and size
- Appearance settings (colors, fonts)
- Timezone configuration
- User preferences (always-on-top, click-through, etc.)

All stored as JSON in your user profile — never shared, never uploaded.

[Full Privacy Policy](store/PRIVACY.md)

## 📝 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) file for details.

### MIT License Summary

You are free to:
- ✅ Use for personal projects
- ✅ Use for commercial purposes
- ✅ Modify and distribute
- ✅ Include in other projects

You must:
- 📋 Include a copy of the license
- 📋 Include copyright notice

No warranty is provided.

## 🛠️ Building from Source

### Prerequisites

- Node.js 18+ and npm/yarn
- Rust 1.77+ (via `rustup`)
- Visual Studio 2022 Build Tools (C++ workload)
- Windows 10/11

### Steps

```bash
# Clone the repository
git clone https://github.com/mutaikevinkiprop/desktop-clock.git
cd desktop-clock

# Install dependencies
npm install

# Development mode (with hot reload)
npm run tauri:dev

# Build for release
npm run tauri build

# Output artifacts:
# - src-tauri/target/release/bundle/msi/
# - src-tauri/target/release/bundle/nsis/
```

### Project Structure

```
desktop-clock/
├── src/                      # React frontend (TypeScript)
│   ├── components/           # React components
│   ├── styles/               # CSS
│   ├── utils/                # Helper functions
│   └── settings/             # Settings UI
├── src-tauri/                # Rust backend (Tauri)
│   ├── src/                  # Rust source
│   ├── tauri.conf.json       # Tauri configuration
│   └── icons/                # App icons
├── public/                   # Static assets
├── package.json              # npm configuration
└── vite.config.ts            # Build configuration
```

## 🔧 Technologies

- **[Tauri v2](https://tauri.app)** — Lightweight desktop framework (Rust + WebView2)
- **[React 18](https://react.dev)** — UI library
- **[TypeScript](https://www.typescriptlang.org/)** — Type-safe JavaScript
- **[Vite](https://vitejs.dev)** — Fast build tool
- **[Zustand](https://github.com/pmndrs/zustand)** — State management
- **[WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/)** — Browser engine

## 📚 Documentation

- [Privacy Policy](store/PRIVACY.md)
- [Store Listing Details](store/STORE_LISTING.md)

## 🤝 Contributing

Found a bug or have a feature request? 

1. Open an [Issue](https://github.com/mutaikevinkiprop/desktop-clock/issues)
2. Describe the problem or feature
3. Include OS version and steps to reproduce

## 💬 Support

For issues, questions, or feature requests:
- **GitHub Issues:** [mutaikevinkiprop/desktop-clock/issues](https://github.com/mutaikevinkiprop/desktop-clock/issues)
- **Check existing issues** before creating a new one

## 🙌 Acknowledgments

Built with [Tauri](https://tauri.app) — making desktop apps simple and secure.

---

**Desktop Clock** © 2026 · Licensed under the MIT License

Made with ❤️ by [mutaikevinkiprop](https://github.com/mutaikevinkiprop)
