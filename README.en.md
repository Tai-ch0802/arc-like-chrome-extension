# Arc-Style Chrome Sidebar

This is a Chrome extension project that aims to bring an Arc browser-like vertical sidebar experience to Google Chrome, providing a unified and powerful panel for managing tabs and bookmarks.

![Project Screenshot](screenshot.png)

---

## 🔥 Key Features

### 🔗 Exclusive Innovation: Linked Tabs
This is our most powerful feature! When you open a bookmark from the sidebar, we automatically create a **"Link"**.
- **Avoid Tab Clutter**: Click the link icon next to a bookmark to see all tabs opened from it, helping you avoid opening duplicates and saving system resources.
- **Two-Way Sync**: When a tab is closed, the bookmark status updates automatically; when a bookmark is deleted, the linked tab is handled intelligently.
- **Visual Feedback**: A refined link icon appears next to bookmarks, letting you know at a glance which ones are currently active.

### ⚡️ Blazing Performance: Virtual Scrolling
Have thousands of bookmarks? No problem!
- **Zero Latency**: Even with **10,000+** bookmarks, the sidebar remains silky smooth.
- **Memory Optimized**: Powered by an advanced virtualization engine that only renders visible items, significantly reducing memory usage.

### 🔍 Professional Grade Search
Don't just search—find instantly.
- **Multi-Keyword Filtering**: Supports space-separated keywords (e.g., "google docs work") for precise targeting.
- **Domain Search**: Type a domain (like `github.com`) to instantly filter tabs and bookmarks from specific sources.
- **Smart Highlighting**: Real-time highlighting of matched keywords keeps your visual focus clear.

### 🗂️ Unified Workspace
- **Vertical Tabs**: View full page titles, no longer compressed into tiny icons.
- **Native Group Support**: Perfectly integrates with Chrome Tab Groups, syncing colors and names.
- **Drag & Drop**: Intuitive management—move items effortlessly between tabs, groups, and bookmark folders.
- **Drag to Save**: Drag a tab into the bookmarks area to save it instantly; drag a bookmark to the tabs area to open it.

### 🎨 Premium Design
- **Focus Mode**: A sleek dark theme with carefully tuned contrast to reduce eye strain.
- **Auto-Expand**: Hover over folders while dragging items to automatically expand the path.
- **Smart Hover**: Action buttons appear only when needed, keeping the interface clean and distraction-free.

### ⌨️ Productivity Shortcuts
- **Cmd/Ctrl + I**: Toggle Sidebar
- **Opt/Alt + T**: Create new tab next to current one

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

### Automated Testing Framework

For future automated testing, we have chosen **Puppeteer** as our End-to-End (E2E) testing framework.

*   **Puppeteer**: A Node.js library that provides a high-level API to control Chromium or Chrome over the DevTools Protocol. It allows us to write scripts to simulate various user actions in the browser, such as clicks, input, navigation, etc., and capture screenshots or retrieve page content for verification.
*   **Installation**: Puppeteer has been installed in the project via `npm install puppeteer`.
*   **Future Outlook**: In the future, the descriptive test cases in `usecase_tests/` will be gradually converted into executable Puppeteer scripts to achieve automated testing and continuous integration.

---

This project is licensed under the MIT License.