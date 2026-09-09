#!/usr/bin/env bash
# Start Flowa Command Center. Installs dependencies the first time only,
# then starts the app and opens it in your browser.
set -e
cd "$(dirname "$0")"

if [ ! -d node_modules ]; then
  echo "Første gang — installerer dependencies..."
  npm install
fi

npm run dev
