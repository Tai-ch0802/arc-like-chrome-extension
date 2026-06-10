# Arc-Style Chrome Sidebar · Your Knowledge Workspace for Chrome

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)


🌐 **Official Website**: [https://sidebar-for-tabs-bookmarks.taislife.work/](https://sidebar-for-tabs-bookmarks.taislife.work/)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](LICENSE)

An Arc-style sidebar that goes **far beyond** Chrome's native vertical tabs: unified tabs + bookmarks + reading list, **zero-config local AI** (auto-name groups, tab cleanup suggestions, hover summaries, natural-language search), **Workspaces** (hibernate & restore tab bundles, sync metadata across devices), a **⌘K Command Palette**, and **Bookmark Tools** for tagging, deduping, and dead-link cleanup — all 100% on-device with no API key required.

## 🚀 New Release v1.14.0 update! 
[![Demo Video](http://img.youtube.com/vi/aRSQ1atlyCw/0.jpg)](https://www.youtube.com/watch?v=aRSQ1atlyCw)

### 🤖 Knowledge Workspace 2026 (new)
- **AI Auto Group Naming**: When you create a new empty tab group, Gemini Nano picks an emoji + short label automatically.
- **AI Tab Cleanup Suggestions**: 🧹 button asks AI which tabs you can safely close, with short reasons.
- **AI Hover Summarize**: Hover any tab for 2s to see a one-sentence summary of the page.
- **AI Reading List Summary Memory**: Pages you add to Reading List get summarized once and stored locally — preview later, even offline.
- **Ask AI to Find** (⌘K): Natural-language search across tabs, bookmarks, and reading-list entries.
- **Workspaces**: Save bundles of tabs as named workspaces; each workspace opens in its own window — switching focuses or reopens it without touching your current tabs, and windows re-bind to their workspaces automatically after a browser restart. Metadata syncs across devices.
- **Command Palette** (⌘K / Ctrl+K): Unified search + actions overlay, Linear/Raycast-style.
- **Bookmark Tools**: 🛠️ panel for multi-tag, duplicate finder, and dead-link checker.
- **Zero Config, No API Key**: All AI runs on Chrome's built-in Gemini Nano. Nothing leaves your machine.

### ⚡️ Established Features
- **Custom Background Image**: Set your own sidebar background via upload or URL, with adjustable opacity and blur.
- **Revamped Settings UI**: A cleaner, organized experience with a new collapsible accordion layout.
- **Custom Theme Colors**: Full control over main background, accent, and text colors.
- **Vertical Tabs**: View full page titles, no longer compressed into tiny icons.
- **Tab Groups**: Perfectly integrates with Chrome Tab Groups, syncing colors and names.
- **Bookmarks Integration**: Unified panel for managing tabs and bookmarks.
- **Linked Tabs**: Automatically creates a "Link" when opening a bookmark, avoiding duplicates.
- **Cross-Window Management**: Manage tabs across all open windows with global search.
- **Dynamic Rendering**: Efficiently handles thousands of bookmarks with smooth performance.
- **Accessibility Shortcuts**: Quick actions with `F2` for renaming and `Delete` for removing items.

## 🤝 Contributing

We welcome contributions from the community! Whether you're fixing a bug, improving documentation, or proposing a new feature, your help is appreciated.

We have a **Spec-Driven Development (SDD)** workflow and are **AI-friendly**. Check out our contributing guide to get started:

👉 **[Read our Contributing Guidelines](CONTRIBUTING.md)**

For a practical example of the development process, please refer to [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30).

---

## 🔥 Key Features

### 🔗 Exclusive Innovation: Linked Tabs
This is our most powerful feature! When you open a bookmark from the sidebar, we automatically create a **"Link"**.
- **Avoid Tab Clutter**: Click the link icon next to a bookmark to see all tabs opened from it, helping you avoid opening duplicates and saving system resources.
- **Two-Way Sync**: When a tab is closed, the bookmark status updates automatically; when a bookmark is deleted, the linked tab is handled intelligently.
- **Visual Feedback**: A refined link icon appears next to bookmarks, letting you know at a glance which ones are currently active.

### ⚡️ Smart Rendering
Have thousands of bookmarks? No problem!
- **Dynamic Rendering**: Switched from Virtual Scrolling to an efficient Dynamic Rendering mechanism, ensuring smooth performance with better compatibility.
- **Smooth Experience**: Navigate through large bookmark libraries effortlessly without lag.

### 🪟 Cross-Window Management
- **Window Overview**: View tabs from all open Chrome windows directly in the sidebar, not just the current one.
- **Global Search**: Search results include tabs from all windows, allowing for instant navigation across your entire session.

### 🔍 Professional Grade Search
Don't just search—find instantly.
- **Multi-Keyword Filtering**: Supports space-separated keywords (e.g., "google docs work") for precise targeting.
- **Domain Search**: Type a domain (like `github.com`) to instantly filter tabs and bookmarks from specific sources.
- **Smart Highlighting**: Real-time highlighting of matched keywords keeps your visual focus clear.

### 🗂️ Unified Workspace
- **Vertical Tabs**: View full page titles, no longer compressed into tiny icons.
- **Native Group Support**: Perfectly integrates with Chrome Tab Groups, syncing colors and names.
- **Custom Window Naming**: Assign custom names to your windows (e.g., "Work", "Personal") for clearer context.
- **Drag & Drop**: Intuitive management—move items effortlessly between tabs, groups, and bookmark folders.
- **Drag to Save**: Drag a tab into the bookmarks area to save it instantly; drag a bookmark to the tabs area to open it.

### 🎨 Premium Design
- **Focus Mode**: A sleek dark theme with carefully tuned contrast to reduce eye strain.
- **Auto-Expand**: Hover over folders while dragging items to automatically expand the path.
- **Smart Hover**: Action buttons appear only when needed, keeping the interface clean and distraction-free.

### 📚 Reading List & RSS
Your personal article curation hub, right in the sidebar.
- **Chrome Reading List Integration**: Synced with Chrome's native Reading List for seamless "Save for Later" functionality.
- **RSS Subscription**: Subscribe to any RSS feed and have new articles automatically added to your reading list.
- **Smart Deduplication**: Hash-based filtering ensures no duplicate entries, even across multiple fetches.
- **Sorting Options**: Sort by date (newest/oldest) or title for quick access.
- **Manual Fetch**: Instantly pull the latest articles with a "Fetch Now" button.
- **Batch Clear**: Remove all read items with one click.


## ⌨️ Full Keyboard Navigation
- **Native Experience**: Use `Arrow Up`/`Arrow Down` keys to navigate seamlessly between tabs and bookmarks.
- **Micro-Interactions**: Use `Arrow Left`/`Arrow Right` to navigate and trigger internal buttons (like Close, Add to Group).
- **Search Integration**: Press `Up` at the top of the list to focus the search bar; press `Down` in the search bar to jump to results.
- **Focus Tip**: Once the sidebar is open, simply press any arrow key to automatically grab focus and start navigating.

### ⌨️ Productivity Shortcuts
- **Cmd/Ctrl + I**: Toggle Sidebar
- **Opt/Alt + T**: Create new tab next to current one

---

## 🆚 Why Choose This Extension?

Chrome's native vertical tabs (rolled out 2025) handle "show tabs vertically" — that's it. This extension is a full knowledge workspace.

| Feature | This Extension | Chrome Native Vertical Tabs | Traditional 3rd-party Sidebars |
| :--- | :---: | :---: | :---: |
| **Vertical Tabs** | ✅ Full Title | ✅ | ✅ |
| **Tab Groups** | ✅ Native Sync | ✅ | ⚠️ Partial |
| **Bookmarks Integration** | ✅ Unified Panel | ❌ | ❌ |
| **Reading List in panel** | ✅ Built-in | ❌ | ❌ |
| **RSS Subscriptions** | ✅ | ❌ | ❌ |
| **Cross-Window Search** | ✅ | ❌ | ⚠️ Varies |
| **Workspaces (hibernate + restore)** | ✅ Cross-device | ❌ | ⚠️ Varies |
| **Linked Tabs** (bookmark ↔ open tab) | ✅ | ❌ | ❌ |
| **AI Auto Group Naming** | ✅ Local Gemini Nano | ❌ | ❌ |
| **AI Tab Cleanup Suggestions** | ✅ Local Gemini Nano | ❌ | ❌ |
| **AI Hover Page Summary** | ✅ Local Gemini Nano | ❌ | ❌ |
| **Ask AI Find (NL search)** | ✅ Local Gemini Nano | ❌ | ❌ |
| **Bookmark Tools** (tags / dedupe / dead-link) | ✅ | ❌ | ❌ |
| **Command Palette** (⌘K) | ✅ | ❌ | ⚠️ Some |
| **Custom Theme + Background** | ✅ | ❌ | ⚠️ Varies |
| **Performance for 1000+ bookmarks** | ⚡️ Dynamic Rendering | N/A | 🐢 Virtual Scroll |
| **API Key Required** | ❌ Zero config | N/A | ⚠️ Many require |
| **100% Local & Offline** | ✅ | ✅ | ⚠️ Varies |

→ [Full comparison & why native isn't enough](https://sidebar-for-tabs-bookmarks.taislife.work/why-not-native/)

---

## 🚀 Installation & Development

### Option 1: Install from the Chrome Web Store (Recommended)

You can install the extension directly from the official store to receive automatic updates:

[**Click here to install from the Chrome Web Store**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### Option 2: Manual Installation from Source (for Developers)

**1. Prerequisites**

Before you begin, ensure you have [Node.js](https://nodejs.org/) (which includes npm) installed on your system.

**2. Setup Steps**

1.  Clone or download this project to your local machine.
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  Navigate into the project directory and install the required development dependencies:
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  Open the Chrome browser and navigate to `chrome://extensions`.
4.  Enable "Developer mode" in the top right corner.
5.  Click "Load unpacked" and select the project's root directory.

---

## 🛠️ Build Commands

This project uses a `Makefile` to automate the build process.

*   **Development Mode**: `make` or `make package`

    This command creates an unminified development build. All source code remains as-is, making it easy to debug in Chrome's developer tools. The packaged file will be `arc-sidebar-v<version>-dev.zip`.

*   **Production Mode**: `make release`

    This command runs the production build process, which includes the following steps:
    1.  Bundles and minifies all JavaScript modules into a single file using `esbuild`.
    2.  Minifies the CSS file.
    3.  Packages the output into a `.zip` file suitable for uploading to the Chrome Web Store.

---

## 🧪 Testing

To ensure the quality and stability of the project's features, we adopt a use case testing approach to validate every change.

### Use Case Tests

*   **Purpose**: Each use case test clearly defines the expected behavior and operational flow of a specific feature. They are presented in descriptive text, detailing the test steps, preconditions, expected results, and verification methods.
*   **Location**: All use case test files are stored in the `usecase_tests/` folder at the project root.
*   **Execution & Verification**: These tests are currently primarily executed manually. Developers need to simulate user operations in the running Chrome extension according to the steps in the test files and observe whether the results meet expectations.

### Automated Testing

For future automated testing, we have chosen **Puppeteer** as our End-to-End (E2E) testing framework. This allows us to write scripts to simulate various user actions in the browser and verify functionality.


---

## 🔒 Privacy & FAQ

We value your privacy. This extension operates entirely locally and does not collect or transmit your personal data.

For more details, please see our [Privacy Policy](PRIVACY_POLICY.md).

---

## 👥 Contributors

Special thanks to all contributors who help make this project better:

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.