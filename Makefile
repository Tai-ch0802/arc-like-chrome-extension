# Makefile for Chrome Extension Packaging

# --- Configuration ---
# 從 manifest.json 中自動獲取版本號
# 注意: 這需要系統安裝 jq (一個命令列 JSON 處理工具)
# 如果沒有 jq，可以手動設定 VERSION 變數，例如 VERSION=1.0
VERSION := $(shell jq -r .version manifest.json)
ZIP_FILE = arc-sidebar-v$(VERSION).zip
BUILD_DIR = build

# --- Files and Directories to Include in the package ---
# 這裡列出了所有需要被打包的檔案和資料夾
SRC_FILES = \
    manifest.json \
    background.js \
    sidepanel.html \
    sidepanel.css \
    sidepanel.js \
    icons \
    lib \
    modules \
	_locales

# --- Targets ---

# The default target, called when you just run `make`
.DEFAULT_GOAL := package

# `make package`: 清理、建置並打包專案
package: clean build zip clean-build
	@echo "✅ Successfully packaged $(ZIP_FILE)"

# `make build`: 複製所有必要的檔案到 build 目錄
build:
	@echo "📦 Creating build directory..."
	@mkdir -p $(BUILD_DIR)
	@cp -R $(SRC_FILES) $(BUILD_DIR)/

# `make zip`: 將 build 目錄壓縮成 zip 檔
zip:
	@echo "🗜️  Zipping contents..."
	@cd $(BUILD_DIR) && zip -r ../$(ZIP_FILE) .

# `make clean`: 刪除舊的打包檔案
clean:
	@echo "🧹 Cleaning up old package file..."
	@rm -f *.zip

# `make clean-build`: 刪除 build 暫存目錄
clean-build:
	@echo "🗑️  Removing build directory..."
	@rm -rf $(BUILD_DIR)

# 讓 make 指令即使有名為 'build', 'zip', 'clean' 的檔案也能正常運作
.PHONY: package build zip clean clean-build