# Chainlit Release SOP

## Quick Release (Minimum Steps)

### 1. Clean Build Environment
```bash
# Remove old frontend builds (important - prevents 38MB bloated wheels)
rm -rf frontend/dist libs/copilot/dist backend/chainlit/frontend/dist backend/chainlit/copilot/dist backend/dist
```

### 2. Build Clean Packages
```bash
# Build frontend and backend in one command
cd backend && uv run python build.py && uv build
```

### 3. Create GitHub Release
```bash
# Create release with both wheel and source
gh release create 2025.8.25 \
  dist/chainlit_aki-2.7.1.1-py3-none-any.whl \
  dist/chainlit_aki-2.7.1.1.tar.gz \
  --repo zhou-san/chainlit \
  --title "2025.8.25" \
  --notes "Release"
```


### 4. Publish

```
uv publish --token {PYPI_TOKEN}
```


## Troubleshooting

### Large Wheel Size (>20MB)
```bash
# Check frontend dist size
du -sh backend/chainlit/frontend/dist/
# Should be ~29MB, not 143MB+

# If too large, clean and rebuild
rm -rf frontend/dist backend/chainlit/frontend/dist
cd frontend && pnpm run build
```

### Platform-Specific Wheel
```bash
# Check wheel filename
ls backend/dist/*.whl
# Should see: chainlit-2.6.0-py3-none-any.whl
# Not: chainlit-2.6.0-cp312-cp312-macosx_15_0_arm64.whl
```

### GitHub CLI Not Available
```bash
# Install GitHub CLI first
brew install gh
gh auth login
```

---

## Full Development Process (Optional)

If you need the complete development workflow:

### Prerequisites
```bash
# Install dependencies
pnpm install
cd backend && poetry install
```

### Build Process Details
1. **Frontend Build**: `cd frontend && pnpm run build` (~29MB)
2. **Copilot Build**: `cd libs/copilot && pnpm run build` (~8MB)
3. **Asset Copy**: Backend build script copies to `backend/chainlit/*/dist/`
4. **Python Build**: `poetry build` creates wheel and source distribution

### Size Optimization
- **Remove source maps**: Production builds shouldn't include `.js.map` files
- **Remove duplicates**: Clean `dist/` folders prevent accumulation
- **Optimize assets**: Vite automatically minifies and compresses
