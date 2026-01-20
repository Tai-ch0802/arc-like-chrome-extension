# Arc-Style Chrome Sidebar

这是一个 Chrome 扩展程序项目，旨在为 Google Chrome 提供类似 Arc 浏览器的垂直侧边栏体验，提供一个统一且强大的面板来管理标签页和书签。

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

## 🚀 New Release v1.11.0 更新！
[![Demo Video](http://img.youtube.com/vi/Ld4lyaZatWo/0.jpg)](https://www.youtube.com/watch?v=Ld4lyaZatWo)

---

## 🔥 核心功能

### 🔗 独家创新：关联标签页 (Linked Tabs)
这是我们最强大的功能！当您从侧边栏打开书签时，我们会自动创建一个 **“链接”**。
- **避免标签页混乱**：点击书签旁的链接图标即可查看从中打开的所有标签页，帮助您避免打开重复页面并节省系统资源。
- **双向同步**：关闭标签页时，书签状态会自动更新；删除书签时，关联的标签页会得到智能处理。
- **视觉反馈**：书签旁会显示精致的链接图标，让您一眼就能掌握哪些书签当前处于活动状态。

### ⚡️ 智能渲染
拥有数千个书签？没问题！
- **动态渲染**：从虚拟滚动切换到高效的动态渲染机制，在保持更好兼容性的同时确保流畅性能。
- **流畅体验**：轻松浏览大型书签库，毫无延迟。

### 🪟 跨窗口管理
- **窗口总览**：直接在侧边栏中查看所有打开的 Chrome 窗口的标签页，而不仅仅是当前窗口。
- **全局搜索**：搜索结果包含所有窗口的标签页，实现整个会话的即时导航。

### 🔍 专业级搜索
不只是搜索，而是瞬间“找到”。
- **多关键词过滤**：支持空格分隔的关键词（例如“google docs 工作”），实现精准定位。
- **域名搜索**：输入域名（如 `github.com`）即可瞬间过滤出特定来源的标签页和书签。
- **智能高亮**：实时高亮匹配的关键词，保持视觉焦点清晰。

### 🗂️ 统一工作空间
- **垂直标签页**：查看完整的页面标题，不再被压缩成微小的图标。
- **原生分组支持**：与 Chrome 标签页组完美集成，同步颜色和名称。
- **自定义窗口命名**：为您的窗口指定自定义名称（例如“工作”、“个人”），以便获得更清晰的上下文。
- **拖放操作**：直观的管理——在标签页、分组和书签文件夹之间轻松移动项目。
- **拖拽保存**：将标签页拖入书签区域即可即时保存；将书签拖入标签页区域即可打开。

### 🎨 高端设计
- **专注模式**：时尚的深色主题，经过精心调校的对比度可减少眼睛疲劳。
- **自动展开**：拖动项目时悬停在文件夹上可自动展开路径。
- **智能悬停**：操作按钮仅在需要时出现，保持界面简洁且无干扰。

## ⌨️ 全键盘导航
- **原生体验**：使用 `上箭头`/`下箭头` 键在标签页和书签之间无缝导航。
- **微交互**：使用 `左箭头`/`右箭头` 导航并触发内部按钮（如关闭、加入分组）。
- **搜索集成**：在列表顶部按 `上` 可聚焦搜索栏；在搜索栏按 `下` 可跳至结果。
- **焦点提示**：侧边栏打开后，只需按任意箭头键即可自动抓取焦点并开始导航。

### ⌨️ 高效快捷键
- **Cmd/Ctrl + I**：切换侧边栏
- **Opt/Alt + T**：在当前标签页旁创建新标签页

---

## 🆚 为什么选择这个扩展程序？

| 功能 | 本扩展程序 | 原生 Chrome | 传统侧边栏 |
| :--- | :---: | :---: | :---: |
| **垂直标签页** | ✅ 完整标题 | ❌ 压缩密集 | ✅ |
| **标签页组** | ✅ 原生同步 | ✅ | ⚠️ 部分支持 |
| **书签集成** | ✅ 统一面板 | ❌ 独立管理器 | ❌ 独立显示 |
| **Linked Tabs** | ✅ 完美同步 | ❌ | ❌ |
| **跨窗口搜索** | ✅ | ❌ | ⚠️ 视版本而定 |
| **性能** | ⚡️ 动态渲染 | N/A | 🐢 虚拟滚动 |

---

## 🚀 安装与开发

### 选项 1：从 Chrome 网上应用店安装（推荐）

您可以直接从官方商店安装扩展程序以获取自动更新：

[**点击此处从 Chrome 网上应用店安装**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 选项 2：从源代码手动安装（针对开发者）

**1. 前提条件**

在开始之前，请确保您的系统中已安装 [Node.js](https://nodejs.org/)（包含 npm）。

**2. 设置步骤**

1.  克隆或下载此项目到本地机器。
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  导航至项目目录并安装所需的开发依赖项：
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  打开 Chrome 浏览器并导航至 `chrome://extensions`。
4.  开启右上角的“开发者模式”。
5.  点击“加载已解压的扩展程序”并选择项目的根目录。

---

## 🛠️ 构建命令

本项目使用 `Makefile` 来自动化构建过程。

*   **开发模式**：`make` 或 `make package`

    此命令创建一个未经缩减的开发构建。所有源代码保持原样，方便在 Chrome 的开发者工具中进行调试。打包后的文件名为 `arc-sidebar-v<version>-dev.zip`。

*   **生产模式**：`make release`

    此命令运行生产构建过程，包括以下步骤：
    1.  使用 `esbuild` 将所有 JavaScript 模块打包并压缩到单个文件中。
    2.  压缩 CSS 文件。
    3.  将输出打包成适用于上传到 Chrome 网上应用店的 `.zip` 文件。

---

## 🧪 测试

为了确保项目功能的质量和稳定性，我们采用用例测试方法来验证每次更改。

### 用例测试 (Use Case Tests)

*   **目的**：每个用例测试都清晰地定义了特定功能的预期行为和操作流程。它们以描述性文本呈现，详细说明了测试步骤、前置条件、预期结果和验证方法。
*   **位置**：所有用例测试文件都存储在项目根目录下的 `usecase_tests/` 文件夹中。
*   **执行与验证**：这些测试目前主要手动执行。开发人员需要根据测试文件中的步骤，在运行的 Chrome 扩展程序中模拟用户操作，并观察结果是否符合预期。

### 自动化测试框架

对于未来的自动化测试，我们选择了 **Puppeteer** 作为我们的端到端 (E2E) 测试框架。

*   **Puppeteer**：一个 Node.js 库，提供高级 API 通过 DevTools 协议控制 Chromium 或 Chrome。它允许我们编写脚本来模拟浏览器中的各种用户操作，如点击、输入、导航等，并捕获截图或检索页面内容进行验证。
*   **安装**：已通过 `npm install puppeteer` 在项目中安装了 Puppeteer。
*   **未来展望**：未来，`usecase_tests/` 中的描述性测试用例将逐步转换为可执行的 Puppeteer 脚本，以实现自动化测试和持续集成。

---

## 👥 贡献者

特别感谢所有帮助改进本项目的贡献者：

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

---

## 🔒 隐私与常见问题

我们非常重视您的隐私。本扩展程序完全在本地运行，不会收集或传输您的个人数据。

更多详情，请参阅我们的 [隐私政策](../../PRIVACY_POLICY.md)。

---

本项目采用 MIT 许可证。
