#!/usr/bin/env bash
# Troca o site de um repositório antigo por um redirecionamento para o endereço novo, mantendo o caminho:
# um link antigo para uma aula (#a-...) ou para um PDF (arquivos/...) chega ao mesmo lugar no site novo.
# Uso: bash scripts/redirecionar-site-antigo.sh <repositório antigo> <endereço antigo> <endereço novo>
# Ex.: bash scripts/redirecionar-site-antigo.sh https://github.com/PedroLofiego/financas-economia-gerencial.git \
#        https://pedrolofiego.github.io/financas-economia-gerencial/ https://pantoniofran.github.io/financas-economia-gerencial/
set -euo pipefail

REPO="$1"
ANTIGO="${2%/}/"
NOVO="${3%/}/"
PREFIXO="/$(echo "$ANTIGO" | cut -d/ -f4-)"   # ex.: /financas-economia-gerencial/

DIR="$(mktemp -d)"
pagina() {
  cat <<EOF
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>O site mudou de endereço</title>
<link rel="canonical" href="$NOVO">
<script>
  // Leva para o mesmo caminho no site novo, com a aula ou o material que estava no link.
  var resto = location.pathname.indexOf('$PREFIXO') === 0 ? location.pathname.slice('$PREFIXO'.length) : '';
  location.replace('$NOVO' + resto + location.search + location.hash);
</script>
<style>body{font:17px/1.5 system-ui,sans-serif;margin:0;display:grid;place-items:center;min-height:100vh;background:#fbfcfa;color:#17201b}main{max-width:32rem;padding:24px}a{color:#1d5a44}</style>
</head>
<body><main><h1 style="font-weight:500">O site mudou de endereço</h1><p>Agora ele está em <a href="$NOVO">$NOVO</a>.</p></main></body>
</html>
EOF
}
pagina > "$DIR/index.html"
# O GitHub Pages mostra o 404.html para qualquer caminho que não existe: é ele que redireciona os links de PDF.
pagina > "$DIR/404.html"
touch "$DIR/.nojekyll"

cd "$DIR"
git init -q -b gh-pages
git add -A
git commit -q -m "Site mudou para $NOVO"
git push -q -f "$REPO" gh-pages
cd - >/dev/null
rm -rf "$DIR"
echo "Redirecionamento publicado: $ANTIGO -> $NOVO"
