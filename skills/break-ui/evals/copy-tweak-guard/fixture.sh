#!/usr/bin/env bash
set -euo pipefail
cat > ranking.html <<'D'
<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Ranking</title>
  <style>
    .list { width: 320px; font-family: system-ui, sans-serif; }
    .row { display: flex; align-items: center; gap: 8px; padding: 8px; }
    .avatar { width: 32px; height: 32px; border-radius: 50%; background: #ddd; display: flex; align-items: center; justify-content: center; }
    .name { white-space: nowrap; }
    .badge { background: #eef; padding: 2px 6px; border-radius: 8px; }
    .points { margin-left: auto; }
  </style>
</head>
<body>
  <div id="app" class="list"></div>
  <script>
    const members = [
      { name: "Ana Souza", team: "Flamengo", points: 42 },
      { name: "Bruno Lima", team: "Palmeiras", points: 38 },
      { name: "Carla Dias", team: "Grêmio", points: 31 },
    ];
    function initials(name) {
      const parts = name.split(" ");
      return parts[0][0] + parts[1][0];
    }
    document.getElementById("app").innerHTML = members.map((m) => `
      <div class="row">
        <div class="avatar">${initials(m.name)}</div>
        <div class="name">${m.name}</div>
        <span class="badge">${m.team}</span>
        <div class="points">${m.points} pontos</div>
      </div>`).join("");
  </script>
</body>
</html>
D
