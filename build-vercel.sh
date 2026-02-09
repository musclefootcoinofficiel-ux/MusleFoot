#!/bin/bash
rm -rf vercel-deploy
npx vite build
mkdir -p vercel-deploy
cp -r dist/public/* vercel-deploy/
cp vercel.json vercel-deploy/
echo "vercel-deploy/ ready to upload!"
