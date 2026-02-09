#!/bin/bash
rm -rf netlify-deploy
npx vite build
mkdir -p netlify-deploy
cp -r dist/public/* netlify-deploy/
cat > netlify-deploy/_redirects << 'EOF'
/*    /index.html   200
EOF
cat > netlify-deploy/netlify.toml << 'EOF'
[build]
  command = ""
  publish = "."

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
EOF
sed -i 's|href="/favicon.png"|href="./favicon.png"|g; s|src="/assets/|src="./assets/|g; s|href="/assets/|href="./assets/|g' netlify-deploy/index.html
echo "netlify-deploy/ ready to upload!"
