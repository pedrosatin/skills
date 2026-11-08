#!/usr/bin/env bash
set -euo pipefail
cat > index.html <<'D'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#ffffff" />
  <link rel="stylesheet" href="app.css" />
  <title>Bolão</title>
</head>
<body>
  <section class="hero"><h1>Monte seu bolão</h1><a class="cta" href="#app">Começar</a></section>
  <div class="app" id="app">
    <header class="top">Rodada 35</header>
    <main class="matches">
      <form class="match">
        <span>Vasco</span>
        <input class="score" type="text" aria-label="Gols do Vasco" />
        <input class="score" type="text" aria-label="Gols do Bahia" />
        <span>Bahia</span>
        <button class="save">Salvar</button>
      </form>
      <label>Código do grupo <input class="code" type="text" /></label>
    </main>
    <nav class="tabs"><button class="tab">Palpites</button><button class="tab">Tabela</button></nav>
  </div>
  <aside class="sheet"><h2>Membros</h2><ul class="sheet-list"><li class="member">Ana</li><li class="member">Bruno</li></ul></aside>
</body>
</html>
D
cat > app.css <<'D'
html, body { margin: 0; font-family: system-ui, sans-serif; background: #fff; color: #111; }
body { font-size: 15px; }
a:hover { text-decoration: underline; }
button { font: inherit; cursor: pointer; }
button:hover { opacity: 0.9; }
.hero { min-height: 100vh; display: grid; place-content: center; text-align: center; }
.cta { background: #16a34a; color: #fff; padding: 12px 20px; border-radius: 8px; }
.cta:hover { background: #15803d; }
.app { height: 100vh; display: flex; flex-direction: column; }
.top { padding: 12px; background: #111; color: #fff; }
.matches { flex: 1; overflow-y: auto; padding: 12px; }
.match { display: flex; align-items: center; gap: 8px; }
.score { width: 40px; font-size: 14px; text-align: center; }
.code { font-size: 14px; }
.save:hover { background: #eee; }
.tabs { display: flex; }
.tab { flex: 1; padding: 12px; background: none; border: 0; }
.tab:hover { background: #eee; }
.sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 60vh; background: #fff; border-radius: 12px 12px 0 0; }
.sheet-list { margin: 0; padding: 12px; overflow-y: auto; max-height: 50vh; }
.member:hover { background: #f5f5f5; }
@media (prefers-color-scheme: dark) {
  html, body { background: #0d0d0d; color: #f5f5f5; }
}
D
