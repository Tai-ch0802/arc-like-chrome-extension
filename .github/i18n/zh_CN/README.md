# Arc 风格 Chrome 侧边栏

[English](/.github/i18n/en/README.md) | [繁體中文](/.github/i18n/zh_TW/README.md) | [简体中文](/.github/i18n/zh_CN/README.md) | [日本語](/.github/i18n/ja/README.md) | [한국어](/.github/i18n/ko/README.md) | [Deutsch](/.github/i18n/de/README.md) | [Español](/.github/i18n/es/README.md) | [Français](/.github/i18n/fr/README.md) | [हिन्दी](/.github/i18n/hi/README.md) | [Bahasa Indonesia](/.github/i18n/id/README.md) | [Português (Brasil)](/.github/i18n/pt_BR/README.md) | [Русский](/.github/i18n/ru/README.md) | [ไทย](/.github/i18n/th/README.md) | [Tiếng Việt](/.github/i18n/vi/README.md)

---

[![Version](https://img.shields.io/chrome-web-store/v/beoonblekmppafnjppedgpgfngghebji?style=flat-square&logo=google-chrome&logoColor=white)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Rating](https://img.shields.io/chrome-web-store/rating/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Users](https://img.shields.io/chrome-web-store/users/beoonblekmppafnjppedgpgfngghebji?style=flat-square)](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji)
[![Build Status](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml/badge.svg)](https://github.com/Tai-ch0802/arc-like-chrome-extension/actions/workflows/ci.yml)
[![License](https://img.shields.io/github/license/Tai-ch0802/arc-like-chrome-extension?style=flat-square)](../../LICENSE)

这是一个 Chrome 扩展程序项目，旨在为 Google Chrome 带来类似 Arc 浏览器的垂直侧边栏体验，提供一个统一且强大的面板来管理标签页和书籤。

## 🚀 新版本 v1.13.0 更新！
[![演示视频](http://img.youtube.com/vi/49VWZ-AszYc/0.jpg)](https://www.youtube.com/watch?v=49VWZ-AszYc)

### ⚡️ 功能特点
- **自定义背景图片**：支持通过上传图片或 URL 设置侧边栏背景，并可调整透明度与模糊度。
- **全新设置面板 UI**：采用折叠式（Accordion）布局，让设置项分类更清晰，界面更简洁。
- **自定义主题颜色**：自由调整背景、强调色与文字颜色，打造个人专属风格。
- **垂直标签页**：完整显示页面标题，不再被缩减成细小的图标。
- **标签页群组**：完美整合 Chrome 原生标签页群组，同步显示名称与颜色。
- **书签整合**：在统一的面板中管理所有的标签页与书签。
- **关联标签页 (Linked Tabs)**：打开书签时自动建立关联，避免打开重复的标签页。
- **跨窗口管理**：直接在侧边栏管理所有 Chrome 窗口的标签页，并支持全局搜索。
- **动态渲染技术**：即使拥有数千个书签也能维持流畅的操作体验。
- **无障碍快捷键**：支持 `F2` 快速重命名与 `Delete` 键快速删除项目。


## 🤝 参与贡献

我们欢迎社区的参与！无论是修复 Bug、改进文档，还是提出新功能建议，您的帮助都弥足珍贵。

我们采用 **规格驱动开发 (SDD)** 流程且对 **AI 极为友善**。请查看我们的贡献指南以开始：

👉 **[阅读我们的贡献指南](./CONTRIBUTING.md)**

关于开发流程的实际范例，请参考 [Issue #30](https://github.com/Tai-ch0802/arc-like-chrome-extension/issues/30)。

---

## 🔥 关键功能

### 🔗 独家创新：关联标签页 (Linked Tabs)
这是我们最强大的功能！当您从侧边栏开启书籤时，我们会自动创建一个 **“链接”**。
- **避免标签页混乱**：点击书籤旁的链接图标，即可查看所有从该书籤开启的标签页，帮助您避免重复开启并节省系统资源。
- **双向同步**：当标签页关闭时，书籤状态会自动更新；当书籤被删除时，关联标签页也会得到智能处理。
- **视觉反馈**：书籤旁会出现精緻的链接图标，让您一眼看出哪些书籤目前正处于开启状态。

### ⚡️ 智能渲染
拥有数千个书籤？没问题！
- **动态渲染**：从虚拟滚动 (Virtual Scrolling) 切换到高效的动态渲染机制，确保流畅性能与更好的兼容性。
- **流畅体验**：在庞大的书籤库中轻松导航，毫无延迟。

### 🪟 跨窗口管理
- **窗口概览**：直接在侧边栏查看所有开启的 Chrome 窗口中的标签页，不限于当前窗口。
- **全局搜索**：搜索结果包含所有窗口的标签页，让您在整个作业阶段中即时导航。

### 🔍 专业级搜索
不仅是搜索，而是瞬间找到。
- **多关键字过滤**：支持空格分隔的关键字（例如“google docs 工作”）进行精确定位。
- **域名搜索**：输入域名（如 `github.com`）即可立即过滤来自特定来源的标签页与书籤。
- **智能高亮**：即时高亮匹配的关键字，保持视觉焦点清晰。

### 🗂️ 统一工作区
- **垂直标签页**：查看完整页面标题，不再被压缩。
- **原生群组支持**：与 Chrome 标签页群组完美整合。
- **自定义窗口命名**：为您窗口指定自定义名称（例如“工作”、“个人”），让情境更清晰。
- **拖放操作**：直觉的管理方式——在标签页、群组与书籤文件夹之间轻松移动项目。
- **拖曳保存**：将标签页拖入书籤区域即可立即保存；将书籤拖入标签页区域即可开启。

### 🎨 优质设计
- **专注模式**：精緻的深色主题，经过仔细调整的对比度，减轻眼部负担。
- **自动展开**：在拖曳项目时悬停于文件夹上，会自动展开路径。
- **智能悬停**：功能按钮仅在需要时出现，保持界面简洁且无干扰。

### 📚 阅读清单与 RSS
您的个人文章策展中心，就在侧边栏里。
- **Chrome 阅读清单整合**：与 Chrome 原生的阅读清单同步，无缝“稍后阅读”功能。
- **RSS 订阅**：订阅任何 RSS 源，新文章自动加入您的阅读清单。
- **智能去重**：基于Hash的过滤机制，确保不会重复加入项目。
- **排序选项**：按日期（新至旧／旧至新）或标题排序。
- **手动抓取**：使用“立即抓取”按钮立刻拉取最新文章。
- **批量清除**：一键移除所有已读项目。

## ⌨️ 完整键盘导航
- **原生体验**：使用 `向上`/`向下` 鍵在标签页与书籤之间流畅切换。
- **微互动**：使用 `向左`/`向右` 鍵进行巡览并触发内部按钮（如关闭、加入群组）。
- **搜索整合**：在列表顶部按 `上` 即可聚焦搜索框；在搜索框按 `下` 即可跳转至结果。
- **聚焦秘诀**：侧边栏开启后，只需按下任何方向键即可自动取得焦点并开始导航。

### ⌨️ 生产力快捷键
- **Cmd/Ctrl + I**：切换侧边栏
- **Opt/Alt + T**：在当前标签页旁创建新标签页

---

## 🆚 为什么选择这个扩展程序？

| 功能 | 本扩展程序 | 原生 Chrome | 传统侧边栏 |
| :--- | :---: | :---: | :---: |
| **垂直标签页** | ✅ 完整标题 | ❌ 压缩 | ✅ |
| **标签页群组** | ✅ 原生同步 | ✅ | ⚠️ 部分 |
| **书籤整合** | ✅ 统一面板 | ❌ 独立管理员 | ❌ 独立 |
| **关联标签页** | ✅ 同步状态 | ❌ | ❌ |
| **阅读清单与 RSS** | ✅ 内建 | ⚠️ 基本 | ❌ |
| **跨窗口搜索** | ✅ | ❌ | ⚠️ 因人而异 |
| **性能** | ⚡️ 动态渲染 | N/A | 🐢 虚拟滚动 |


---

## 🚀 安装与开发

### 选项 1：从 Chrome 网上应用店安装（推荐）

您可以直接从官方商店安装扩展程序以接收自动更新：

[**点击此处从 Chrome 网上应用店安装**](https://chromewebstore.google.com/detail/beoonblekmppafnjppedgpgfngghebji?utm_source=item-share-cb)

### 选项 2：从源代码手动安装（供开发者使用）

**1. 前提条件**

在开始之前，请确保您的系统中已安装 [Node.js](https://nodejs.org/)（包含 npm）。

**2. 设置步骤**

1.  将本项目克隆或下载到您的本地电脑。
    ```bash
    git clone https://github.com/Tai-ch0802/arc-like-chrome-extension.git
    ```
2.  导航至项目目录并安装必要的开发依赖项：
    ```bash
    cd arc-like-chrome-extension
    npm install
    ```
3.  打开 Chrome 浏览器并导航至 `chrome://extensions`。
4.  打开右上角的“开发者模式”。
5.  点击“加载已解壓的扩展程序”并选择项目的根目录。

---

## 🛠️ 构建指令

本项目使用 `Makefile` 来自动化构建流程。

*   **开发模式**：`make` or `make package`

    此命令会创建一个未压缩的开发版本。所有源代码保持原样，便于在 Chrome 开发者工具中进行调试。封装后的文件将为 `arc-sidebar-v<版本号>-dev.zip`。

*   **生产模式**：`make release`

    此命令会执行生产环境的构建流程，包含以下步骤：
    1.  使用 `esbuild` 将所有 JavaScript 模块打包并压缩成单一文件。
    2.  压缩 CSS 文件。
    3.  将输出结果封装成适合上传至 Chrome 网上应用店的 `.zip` 文件。

---

## 🧪 测试

为了确保项目功能的质量与稳定性，我们采用使用案例测试 (Use Case Testing) 方式来验证每一次改动。

### 使用案例测试

*   **目的**：每个使用案例测试都清楚定义了特定功能的预期行为与操作流程。它们以描述性文字呈现，详细说明测试步骤、前提条件、预期结果与验证方法。
*   **位置**：所有使用案例测试文件均存放在项目根目录的 `usecase_tests/` 文件夹中。
*   **执行与验证**：目前这些测试主要由手动执行。开发者需要根据测试文件中的步骤，在运行的 Chrome 扩展程序中模拟用户操作，并观察结果是否符合预期。

### 自动化测试

针对未来的自动化测试，我们选择 **Puppeteer** 作为我们的端对端 (E2E) 测试框架。这允许我们编写脚本来模拟浏览器中的各种用户操作并验证功能。

---

## 🔒 隐私与常见问题

我们非常重视您的隐私。本扩展程序完全在本地运行，不会收集或传输您的个人资料。

更多详细信息，请参见我们的 [隐私政策](../../PRIVACY_POLICY.md)。

---

## 👥 贡献者

特别感谢所有帮助打造更佳项目的贡献者：

<a href="https://github.com/Tai-ch0802/arc-like-chrome-extension/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=Tai-ch0802/arc-like-chrome-extension" />
</a>

## 📜 许可协议

本项目采用 MIT 许可协议 - 详见 [LICENSE](../../LICENSE) 文件。
