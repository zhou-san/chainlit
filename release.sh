#!/bin/bash

# Chainlit Release Script
# Usage: ./release.sh <version> [release_date]
# Example: ./release.sh 2.6.3 2025.7.17

set -e  # Exit on any error

# Check if version is provided
if [ $# -lt 1 ]; then
    echo "Usage: $0 <version> [release_date]"
    echo "Example: $0 2.6.3 2025.7.17"
    exit 1
fi

VERSION="$1"
RELEASE_DATE="${2:-$(date +%Y.%m.%d)}"  # Use provided date or current date

echo "🚀 Starting Chainlit release process..."
echo "Version: $VERSION"
echo "Release Date: $RELEASE_DATE"
echo ""

# Step 1: Clean Build Environment
echo "🧹 Cleaning build environment..."
rm -rf frontend/dist libs/copilot/dist backend/chainlit/frontend/dist backend/chainlit/copilot/dist backend/dist
echo "✅ Build environment cleaned"

# Step 2: Build Clean Packages
echo "🔨 Building packages..."
cd backend && python build.py && poetry build
cd ..
echo "✅ Packages built"

# Step 3: Create Universal Wheel
echo "🌍 Creating universal wheel..."

# Find the platform-specific wheel file
PLATFORM_WHEEL=$(find backend/dist -name "chainlit-${VERSION}-*.whl" | head -1)
if [ -z "$PLATFORM_WHEEL" ]; then
    echo "❌ Error: No wheel file found for version $VERSION"
    exit 1
fi

UNIVERSAL_WHEEL="backend/dist/chainlit-${VERSION}-py3-none-any.whl"

# Create universal wheel using Python script
python3 -c "
import zipfile, os, tempfile, shutil, sys

wheel_path = '$PLATFORM_WHEEL'
universal_path = '$UNIVERSAL_WHEEL'
shutil.copy2(wheel_path, universal_path)

with tempfile.TemporaryDirectory() as temp_dir:
    with zipfile.ZipFile(universal_path, 'r') as zip_ref:
        zip_ref.extractall(temp_dir)
    
    for root, dirs, files in os.walk(temp_dir):
        for file in files:
            if file == 'WHEEL':
                wheel_file = os.path.join(root, file)
                with open(wheel_file, 'r') as f:
                    content = f.read()
                # Replace any platform-specific tag with universal tag
                import re
                content = re.sub(r'Tag: cp\d+-cp\d+-.*', 'Tag: py3-none-any', content)
                with open(wheel_file, 'w') as f:
                    f.write(content)
                break
    
    os.remove(universal_path)
    with zipfile.ZipFile(universal_path, 'w', zipfile.ZIP_DEFLATED) as zip_ref:
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, temp_dir)
                zip_ref.write(file_path, arcname)

print(f'✅ Universal wheel created: {universal_path}')
"

echo "✅ Universal wheel created"

# Step 4: Create GitHub Release
echo "📦 Creating GitHub release..."

# Check if gh CLI is available
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed. Please install it first:"
    echo "brew install gh"
    echo "gh auth login"
    exit 1
fi

# Create release
SOURCE_TAR="backend/dist/chainlit-${VERSION}.tar.gz"

gh release create "$RELEASE_DATE" \
  "$UNIVERSAL_WHEEL" \
  "$SOURCE_TAR" \
  --repo zhou-san/chainlit \
  --title "$RELEASE_DATE" \
  --notes "Release $VERSION"

echo "✅ GitHub release created"

# Step 5: Show results
echo ""
echo "🎉 Release completed successfully!"
echo ""
echo "📊 Results:"
echo "Universal Wheel: $(basename "$UNIVERSAL_WHEEL") ($(du -h "$UNIVERSAL_WHEEL" | cut -f1))"
echo "Source Distribution: $(basename "$SOURCE_TAR") ($(du -h "$SOURCE_TAR" | cut -f1))"
echo ""
echo "🔗 Release URL: https://github.com/zhou-san/chainlit/releases/tag/$RELEASE_DATE"


rm "$PLATFORM_WHEEL"
echo "✅ Platform-specific wheel removed"

echo ""
echo "✨ Release process complete!"
