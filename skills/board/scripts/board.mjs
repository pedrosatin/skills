#!/usr/bin/env node
// board — verifica e abre a board do projeto (Project Hub em .scratch/index.html).
//
// Uso:
//   node scripts/board.mjs [--root <dir>] [--print] [--json]
//
// Exit codes:
//   0  board encontrada (aberta, ou apenas resolvida com --print/--json)
//   1  board ausente: falta .scratch/ ou .scratch/index.html
//   2  erro de uso (flag inválida)

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const USAGE = `Uso: node scripts/board.mjs [opções]

Verifica se .scratch/index.html existe e abre a board no navegador padrão.

Opções:
  --root <dir>   raiz do projeto (default: sobe do cwd até achar .scratch/ ou o root do git)
  --print, -p    resolve e imprime o caminho/URL, sem abrir o navegador
  --json         imprime JSON com o resultado ({found, root, scratch, path, url, ...})
  --help, -h     mostra esta ajuda`;

class UsageError extends Error {}

function parseArgs(argv) {
  const opts = { root: null, print: false, json: false, help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      const value = argv[i + 1];
      if (!value) throw new UsageError('--root exige um diretório');
      opts.root = value;
      i += 1;
    } else if (arg.startsWith('--root=')) {
      opts.root = arg.slice('--root='.length);
    } else if (arg === '--print' || arg === '-p') {
      opts.print = true;
    } else if (arg === '--json') {
      opts.json = true;
    } else if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else {
      throw new UsageError(`flag desconhecida: ${arg}`);
    }
  }
  return opts;
}

function isDirectory(target) {
  try {
    return fs.statSync(target).isDirectory();
  } catch {
    return false;
  }
}

// Sobe a partir de `start` procurando um diretório .scratch/. Para no primeiro
// que encontrar ou na raiz do git, para não vazar para um repositório pai.
function locate(start) {
  const initial = path.resolve(start);
  let dir = initial;
  while (true) {
    const scratch = path.join(dir, '.scratch');
    if (isDirectory(scratch)) {
      return { root: dir, scratch, found: true };
    }
    if (fs.existsSync(path.join(dir, '.git'))) {
      return { root: dir, scratch: path.join(dir, '.scratch'), found: false };
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return { root: initial, scratch: path.join(initial, '.scratch'), found: false };
    }
    dir = parent;
  }
}

function openTarget(target) {
  const platform = process.platform;
  let command;
  let args;
  if (platform === 'darwin') {
    command = 'open';
    args = [target];
  } else if (platform === 'win32') {
    command = 'cmd';
    args = ['/c', 'start', '', target];
  } else {
    command = 'xdg-open';
    args = [target];
  }
  const result = spawnSync(command, args, { stdio: 'ignore', timeout: 5000 });
  if (result.error) {
    const reason =
      result.error.code === 'ENOENT'
        ? `${command} não encontrado no PATH`
        : result.error.message;
    return { ok: false, reason };
  }
  if (result.status !== 0) {
    return { ok: false, reason: `${command} saiu com código ${result.status}` };
  }
  return { ok: true };
}

function guidance({ hasScratch, indexPath }) {
  const lines = [];
  if (hasScratch) {
    lines.push(`Existe .scratch/, mas falta ${indexPath}.`);
    lines.push('Rode /setup (ou `node ~/.agents/skills/setup/scripts/generate-hub.mjs`) para gerar o Project Hub.');
  } else {
    lines.push('Não existe .scratch/ neste projeto.');
    lines.push('Rode /setup para criar .scratch/, os docs e o .scratch/index.html.');
  }
  lines.push('Depois use /to-spec e /to-tickets para popular a board com spec e tickets.');
  lines.push('A board nasce vazia; spec e tickets preenchem as colunas.');
  return lines;
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`Erro: ${error.message}\n`);
      console.error(USAGE);
      return 2;
    }
    throw error;
  }

  if (opts.help) {
    console.log(USAGE);
    return 0;
  }

  const { root, scratch, found: hasScratch } = locate(opts.root || process.cwd());
  const indexPath = path.join(scratch, 'index.html');
  const exists = hasScratch && fs.existsSync(indexPath);

  if (!exists) {
    const lines = guidance({ hasScratch, indexPath });
    if (opts.json) {
      console.log(
        JSON.stringify({ found: false, root, scratch, path: null, url: null, guidance: lines }, null, 2),
      );
    } else {
      console.log(`✗ Board não encontrada em ${root}\n`);
      for (const line of lines) console.log(`  ${line}`);
    }
    return 1;
  }

  const url = pathToFileURL(indexPath).href;
  const relativeToCwd = path.relative(process.cwd(), indexPath);
  const display =
    relativeToCwd && !relativeToCwd.startsWith('..') && !path.isAbsolute(relativeToCwd)
      ? relativeToCwd
      : indexPath;

  let opened = { ok: false };
  if (!opts.print) opened = openTarget(url);

  if (opts.json) {
    console.log(
      JSON.stringify(
        {
          found: true,
          root,
          scratch,
          path: indexPath,
          url,
          opened: opts.print ? false : opened.ok,
          ...(opened.ok || opts.print ? {} : { openError: opened.reason }),
        },
        null,
        2,
      ),
    );
    return 0;
  }

  console.log(`✓ Board: ${display}`);
  console.log(`  ${url}`);
  if (opts.print) return 0;
  if (opened.ok) {
    console.log('  Abrindo no navegador padrão...');
  } else {
    console.log(`  Não consegui abrir o navegador (${opened.reason}).`);
    console.log('  Abra o link acima manualmente.');
  }
  return 0;
}

process.exitCode = main();
