# Arc-Style Chrome Sidebar

This is a Chrome extension project that aims to bring an Arc browser-like vertical sidebar experience to Google Chrome, providing a unified and powerful panel for managing tabs and bookmarks.

![Project Screenshot](screenshot.png)

---

## ⚡ Features

* **Unified Management Interface**: Manage all your **tabs** and **bookmarks** in a single, clean sidebar.
* **Powerful Interactions**:
    * **Drag & Drop Sorting**: Freely reorder tabs, tab groups, bookmarks, and bookmark folders just the way you like.
    * **Cross-Zone Dragging**: Quickly create a new bookmark by simply dragging a tab into any bookmark folder.
    * **Hover-to-Open**: While dragging, hover over a collapsed folder for a second, and it will automatically expand, allowing you to drop items into deeply nested structures with ease.
    * **Quick Actions**: Use hover-activated buttons to quickly close a tab, delete a bookmark, or create a new folder inside another.
* **Smart State Persistence**: The expanded/collapsed state of your bookmark folders is remembered. Even after the list refreshes from an action like creating or deleting a bookmark, your view state is perfectly restored.
* **Native Feature Integration**:
    * **Tab Groups**: Flawlessly renders native Chrome Tab Groups, including their titles and colors, in a collapsible interface.
    * **Favicons**: Automatically fetches and displays favicons for both tabs and bookmarks for easy identification.
* **Instant Search & Filter**: Instantly filter through all visible tabs and bookmarks by simply typing a keyword.
* **Custom Geek Theme**: Features a high-contrast dark theme with a hacker-green accent, designed for both style and readability.
* **Keyboard Shortcut**: Toggle the sidebar with `Command+I` (Mac) or `Ctrl+I` (Windows).

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

This project is licensed under the MIT License.