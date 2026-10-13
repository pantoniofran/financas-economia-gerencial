#!/usr/bin/env bash
# Publica a versão pública do site (dist/site) no GitHub Pages.
# Só os arquivos do site vão para o GitHub, no ramo gh-pages; o código-fonte e a pasta
# migracao/ ficam neste computador.
#
# Uso: bash scripts/publicar-github.sh https://github.com/USUARIO/REPOSITORIO.git
set -euo pipefail

REPO="${1:?informe o endereço do repositório, por exemplo https://github.com/PedroLofiego/financas-economia-gerencial.git}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
cd "$RAIZ"

# Endereço final do site, a partir do endereço do repositório: usuario.github.io/repositorio/
USUARIO="$(echo "$REPO" | sed -E 's#https://github.com/([^/]+)/.*#\1#' | tr '[:upper:]' '[:lower:]')"
NOME="$(basename "$REPO" .git)"
export SITE_URL="https://${USUARIO}.github.io/${NOME}/"

npm test
npm run build

TMP="$(mktemp -d)"
cp -r dist/site/. "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$RAIZ" config user.name)" -c user.email="$(git -C "$RAIZ" config user.email)" \
  commit -q -m "Publica o site (versão $(git -C "$RAIZ" rev-parse --short HEAD))"
git push --force "$REPO" gh-pages

echo
echo "Publicado em: $SITE_URL"
echo "(a primeira publicação leva um ou dois minutos para aparecer)"
