#!/usr/bin/env bash
# Script per pubblicare il pacchetto su https://www.npmjs.com/
# Uso: ./scripts/publish-to-npm.sh

set -e

echo "=== Pubblicazione su npm ==="
echo ""

# Verifica di essere nella root del progetto
if [ ! -f "package.json" ]; then
  echo "Esegui lo script dalla root del progetto (dove si trova package.json)."
  exit 1
fi

# Verifica login npm
if ! npm whoami &>/dev/null; then
  echo "Non risulti loggato su npm. Esegui prima: npm login"
  exit 1
fi

echo "Utente npm: $(npm whoami)"
echo "Pacchetto:  $(node -e "console.log(require('./package.json').name)")"
echo "Versione:   $(node -e "console.log(require('./package.json').version)")"
echo ""

# Build
echo ">> Build in corso..."
npm run build
echo ""

# Pubblicazione (usa il flusso n8n: version bump + changelog + publish)
echo ">> Avvio 'npm run release' (version bump, tag git, publish su npm)..."
echo "   Per saltare il bump di versione usa: npm run build && npm publish"
echo ""
npm run release

echo ""
echo "=== Pubblicazione completata ==="
