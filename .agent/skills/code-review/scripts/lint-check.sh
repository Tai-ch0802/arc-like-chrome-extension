#!/bin/bash
# lint-check.sh - 程式碼檢查腳本
# 用於 code-review skill 的自動化檢查
#
# 使用方式：
#   .agent/skills/code-review/scripts/lint-check.sh [專案路徑]
#
# 範例：
#   .agent/skills/code-review/scripts/lint-check.sh .
#   .agent/skills/code-review/scripts/lint-check.sh ./modules

set -e

PROJECT_ROOT="${1:-.}"
ISSUES_FOUND=0

# 顏色定義
RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "🔍 開始程式碼檢查..."
echo "專案路徑: $PROJECT_ROOT"
echo "════════════════════════════════════════"
echo ""

# 輔助函式：執行檢查並報告結果
check_pattern() {
    local pattern="$1"
    local description="$2"
    local severity="$3"  # error, warning, info
    local include_pattern="${4:-*.js}"
    
    echo "📋 $description"
    
    local results
    results=$(grep -rn "$pattern" --include="$include_pattern" "$PROJECT_ROOT" 2>/dev/null | grep -v "node_modules" | grep -v ".agent/" || true)
    
    if [ -n "$results" ]; then
        echo "$results" | head -20
        local count
        count=$(echo "$results" | wc -l | tr -d ' ')
        
        case $severity in
            error)
                echo -e "${RED}❌ 發現 $count 處問題，這是安全風險${NC}"
                ISSUES_FOUND=$((ISSUES_FOUND + 1))
                ;;
            warning)
                echo -e "${YELLOW}⚠️  發現 $count 處，請檢查是否需要處理${NC}"
                ;;
            info)
                echo -e "${BLUE}📝 發現 $count 處待處理項目${NC}"
                ;;
        esac
        
        if [ "$count" -gt 20 ]; then
            echo "   (僅顯示前 20 筆，共 $count 筆)"
        fi
    else
        echo -e "${GREEN}✅ 沒有發現問題${NC}"
    fi
    echo ""
}

# ===== 安全性檢查 =====
echo "【安全性檢查】"
echo "────────────────────────────────────────"

check_pattern "eval\s*(" "檢查危險的 eval 使用..." "error"
check_pattern "new Function\s*(" "檢查危險的 new Function 使用..." "error"
check_pattern "innerHTML\s*=" "檢查潛在的 XSS 風險 (innerHTML)..." "warning"
check_pattern "outerHTML\s*=" "檢查潛在的 XSS 風險 (outerHTML)..." "warning"
check_pattern "document\.write" "檢查 document.write 使用..." "warning"

# ISSUE-257：偏好設定一律經 modules/prefs/prefsStore.js（storage.local pref_* 記錄 + Drive 同步）。
# storage.sync 只剩 wsMeta_*（workspaceManager，用 setStorageStrict）與一次性 legacy 遷移讀取。
check_pattern "setStorage('sync'" "檢查偏好設定直寫 storage.sync（應改 prefsStore.setPref）..." "warning"
check_pattern "getStorage('sync', {" "檢查偏好設定直讀 storage.sync（應改 prefsStore.getPref）..." "warning"

# ===== 程式碼品質檢查 =====
echo "【程式碼品質檢查】"
echo "────────────────────────────────────────"

check_pattern "console\.log" "檢查殘留的 console.log..." "warning"
check_pattern "console\.debug" "檢查殘留的 console.debug..." "warning"
check_pattern "debugger" "檢查殘留的 debugger 語句..." "warning"

# ===== 錯誤處理檢查 =====
echo "【錯誤處理檢查】"
echo "────────────────────────────────────────"

check_pattern "\.then\s*([^.]*$" "檢查未處理的 Promise (缺少 .catch)..." "warning"
check_pattern "catch\s*{\s*}" "檢查空的 catch 區塊..." "warning"

# ===== 待辦事項檢查 =====
echo "【待辦事項檢查】"
echo "────────────────────────────────────────"

check_pattern "TODO" "檢查 TODO 註解..." "info"
check_pattern "FIXME" "檢查 FIXME 註解..." "info"
check_pattern "HACK" "檢查 HACK 註解..." "info"
check_pattern "XXX" "檢查 XXX 註解..." "info"

# ===== Chrome Extension 專屬檢查 =====
echo "【Chrome Extension 專屬檢查】"
echo "────────────────────────────────────────"

check_pattern "chrome\.extension\." "檢查已棄用的 chrome.extension API..." "warning"
check_pattern "chrome\.tabs\.executeScript" "檢查 Manifest V2 風格的 executeScript..." "warning"

# ===== 總結 =====
echo "════════════════════════════════════════"
if [ $ISSUES_FOUND -gt 0 ]; then
    echo -e "${RED}🏁 檢查完成，發現 $ISSUES_FOUND 個嚴重問題需要處理${NC}"
    exit 1
else
    echo -e "${GREEN}🏁 檢查完成，沒有發現嚴重問題${NC}"
    exit 0
fi
