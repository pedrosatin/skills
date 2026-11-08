#!/usr/bin/env bash
set -euo pipefail
cat > index.html <<'D'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="styles.css" />
  <title>Bolão</title>
</head>
<body>
  <div class="app">
    <header class="top">Rodada 35</header>
    <main>
      <label>Buscar jogo <input class="search" type="text" /></label>
      <button class="save">Salvar palpite</button>
      <a class="link" href="#ranking">Ver ranking</a>
    </main>
    <nav class="bottom-bar"><button class="tab">Palpites</button><button class="tab">Tabela</button></nav>
  </div>
</body>
</html>
D
cat > styles.css <<'D'
html, body { margin: 0; font-family: system-ui, sans-serif; }
.app { min-height: 100vh; display: flex; flex-direction: column; }
.top { position: sticky; top: 0; background: #0d0d0d; color: #fff; padding: 12px; }
main { flex: 1; padding: 16px; }
.search { font-size: 14px; padding: 8px; }
.save { background: #16a34a; color: #fff; border: 0; padding: 10px 14px; }
.save:hover { background: #15803d; }
.link:hover { text-decoration: underline; }
.tab { flex: 1; padding: 12px; background: none; border: 0; }
.tab:hover { background: #eee; }
.bottom-bar { position: fixed; bottom: 0; left: 0; right: 0; display: flex; background: #fff; border-top: 1px solid #ddd; }
D
