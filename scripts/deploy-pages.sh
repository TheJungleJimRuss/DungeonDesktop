#!/bin/sh
# Builds the app for GitHub Pages and force-pushes dist/ to the gh-pages branch.
set -e
cd "$(dirname "$0")/.."
npm run build -- --base=/DungeonDesktop/
touch dist/.nojekyll
SRC=$(git rev-parse --short HEAD)
URL=$(git remote get-url origin)
cd dist
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy DungeonDesktop build from $SRC"
git push -f "$URL" gh-pages
rm -rf .git
