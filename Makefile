# Makefile for Chrome Extension Packaging

# --- Configuration ---
VERSION := $(shell jq -r .version manifest.json)

# Development build settings
DEV_ZIP_FILE = arc-sidebar-v$(VERSION)-dev.zip
DEV_BUILD_DIR = build
DEV_SRC_FILES = \
    manifest.json \
    background.js \
    sidepanel.html \
    sidepanel.css \
    sidepanel.js \
    icons \
    lib \
    modules \
    _locales

# Production build settings
PROD_ZIP_FILE = arc-sidebar-v$(VERSION).zip
PROD_BUILD_DIR = build-prod
PROD_STATIC_FILES = \
    manifest.json \
    icons \
    lib \
    _locales

# --- Targets ---

# Default target: build for development
.DEFAULT_GOAL := package

# --- Development Targets ---
# `make` or `make package`: Create a development package
package: clean build zip clean-build
	@echo "✅ Successfully packaged development version: $(DEV_ZIP_FILE)"

build:
	@echo "📦 Creating development build directory..."
	@mkdir -p $(DEV_BUILD_DIR)
	@cp -R $(DEV_SRC_FILES) $(DEV_BUILD_DIR)/

zip:
	@echo "🗜️  Zipping development contents..."
	@cd $(DEV_BUILD_DIR) && zip -qr ../$(DEV_ZIP_FILE) .


# --- Production Targets ---
# `make release`: Create a production-ready package for the Chrome Web Store
release: clean build-prod zip-prod clean-build-prod
	@echo "✅ Successfully packaged production version: $(PROD_ZIP_FILE)"

build-prod:
	@echo "📦 Creating production build directory..."
	@mkdir -p $(PROD_BUILD_DIR)
	@echo "    - Copying static assets..."
	@cp -R $(PROD_STATIC_FILES) $(PROD_BUILD_DIR)/
	@echo "    - Bundling and minifying JS with esbuild..."
	@npx esbuild sidepanel.js --bundle --minify --outfile=$(PROD_BUILD_DIR)/sidepanel.js
	@npx esbuild background.js --bundle --minify --outfile=$(PROD_BUILD_DIR)/background.js
	@echo "    - Minifying CSS with esbuild..."
	@npx esbuild sidepanel.css --minify --outfile=$(PROD_BUILD_DIR)/sidepanel.css
	@echo "    - Preparing HTML for production..."
	@cp sidepanel.html $(PROD_BUILD_DIR)/sidepanel.html
	@sed -i '' 's/type="module" //' $(PROD_BUILD_DIR)/sidepanel.html

zip-prod:
	@echo "🗜️  Zipping production contents..."
	@cd $(PROD_BUILD_DIR) && zip -qr ../$(PROD_ZIP_FILE) .


# --- Cleanup Targets ---
# `make clean`: Remove all zip files and build directories
clean:
	@echo "🧹 Cleaning up old packages and directories..."
	@rm -f *.zip
	@rm -rf arc-sidebar-v*
	@rm -rf $(DEV_BUILD_DIR) $(PROD_BUILD_DIR)

# Deprecated cleanup targets, kept for compatibility if needed
clean-build: 
	@rm -rf $(DEV_BUILD_DIR)

clean-build-prod:
	@rm -rf $(PROD_BUILD_DIR)


.PHONY: package build zip release build-prod zip-prod clean clean-build clean-build-prod
