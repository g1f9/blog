#!/usr/bin/env sh
set -e
npm run build
cd docs/.vuepress/dist
git init
git add -A
git commit -m 'deploy'

git push -f git@github.com:g1f9/g1f9.github.io.git master

cd -
