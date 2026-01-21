#!/bin/bash

# Pull Request Pre-check Script
# 此腳本在建立 PR 前驗證內容完整性
# Usage: ./.agent/skills/pull-request/scripts/check-pr.sh [--run-tests]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASS=0
FAIL=0
WARN=0

# Helper functions
print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASS++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAIL++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARN++))
}

# Parse arguments
RUN_TESTS=false
for arg in "$@"; do
    case $arg in
        --run-tests)
            RUN_TESTS=true
            shift
            ;;
    esac
done

print_header "Pull Request Pre-check"

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${BLUE}${CURRENT_BRANCH}${NC}"
echo ""

# ============================================
# 1. Git Checks
# ============================================
print_header "Git Status Checks"

# Check if on main branch
if [ "$CURRENT_BRANCH" == "main" ] || [ "$CURRENT_BRANCH" == "master" ]; then
    check_fail "You are on the default branch ($CURRENT_BRANCH). Please create a feature branch."
else
    check_pass "On feature branch: $CURRENT_BRANCH"
fi

# Check for uncommitted changes
if [ -n "$(git status --porcelain)" ]; then
    check_warn "Uncommitted changes detected. Consider committing before PR."
else
    check_pass "No uncommitted changes"
fi

# Check if branch is pushed to remote
if git rev-parse --verify "origin/$CURRENT_BRANCH" > /dev/null 2>&1; then
    check_pass "Branch is pushed to remote"
else
    check_fail "Branch is NOT pushed to remote. Run: git push -u origin $CURRENT_BRANCH"
fi

# Check for commits ahead of main
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null || echo "0")
if [ "$AHEAD" -gt 0 ]; then
    check_pass "$AHEAD commit(s) ahead of main"
else
    check_warn "No commits ahead of main. Are you sure there are changes?"
fi

# Check for merge conflicts with main
if git merge-base --is-ancestor origin/main HEAD 2>/dev/null; then
    check_pass "No merge conflicts with main (main is ancestor)"
else
    # Try to detect conflict
    if git merge --no-commit --no-ff origin/main > /dev/null 2>&1; then
        git merge --abort > /dev/null 2>&1
        check_pass "No merge conflicts with main"
    else
        git merge --abort > /dev/null 2>&1
        check_fail "Potential merge conflicts with main. Consider rebasing."
    fi
fi

# ============================================
# 2. Commit Message Checks
# ============================================
print_header "Commit Message Checks"

# Get last commit message
LAST_COMMIT=$(git log -1 --pretty=%B)

# Check for conventional commit format
if echo "$LAST_COMMIT" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)(\([a-zA-Z0-9_-]+\))?:"; then
    check_pass "Last commit follows Conventional Commits format"
else
    check_warn "Last commit may not follow Conventional Commits format"
    echo "         Last commit: ${LAST_COMMIT:0:50}..."
fi

# ============================================
# 3. Code Quality Checks
# ============================================
print_header "Code Quality Checks"

# Check for console.log statements in staged files (excluding test files)
CONSOLE_LOGS=$(git diff origin/main --name-only | xargs grep -l "console\.log" 2>/dev/null | grep -v "\.test\." | grep -v "node_modules" || true)
if [ -n "$CONSOLE_LOGS" ]; then
    check_warn "console.log found in modified files:"
    echo "$CONSOLE_LOGS" | while read file; do
        echo "         - $file"
    done
else
    check_pass "No console.log in production code"
fi

# Check for TODO comments in changed files
TODOS=$(git diff origin/main --name-only | xargs grep -l "TODO\|FIXME\|XXX" 2>/dev/null | grep -v "node_modules" || true)
if [ -n "$TODOS" ]; then
    check_warn "TODO/FIXME comments found in modified files:"
    echo "$TODOS" | while read file; do
        echo "         - $file"
    done
else
    check_pass "No TODO/FIXME in modified files"
fi

# ============================================
# 4. Test Checks (Optional)
# ============================================
if [ "$RUN_TESTS" = true ]; then
    print_header "Running Tests"
    
    if npm test > /dev/null 2>&1; then
        check_pass "All tests passed"
    else
        check_fail "Tests failed! Run 'npm test' for details."
    fi
else
    print_header "Test Checks (Skipped)"
    echo -e "${YELLOW}ℹ${NC} Run with --run-tests to execute test suite"
fi

# ============================================
# 5. PR Template Check
# ============================================
print_header "PR Template Check"

if [ -f ".github/pull_request_template.md" ]; then
    check_pass "PR template exists at .github/pull_request_template.md"
else
    check_warn "No PR template found. Consider creating .github/pull_request_template.md"
fi

# ============================================
# Summary
# ============================================
print_header "Summary"

echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${YELLOW}Warnings: $WARN${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -gt 0 ]; then
    echo -e "${RED}Please fix the failed checks before creating a PR.${NC}"
    exit 1
else
    echo -e "${GREEN}All critical checks passed! You can create your PR.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Run: gh pr create"
    echo "  2. Fill in the PR description using the template"
    echo "  3. Add reviewers and labels"
    exit 0
fi
