# break-ui eval verdict

Date: 2026-11-08. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Write Edit`. The without-arm is a plain prompt with the same text. Measured on upstream `5206a950b715` with the local description overlay.

| Case | WITH | W/OUT | Δ | Sabotaged |
|---|---|---|---|---|
| ranking-worst-case | 0.97 | 0.80 | +0.17 | 0.74 |
| copy-tweak-guard | 1.00 | 1.00 | 0.00 | 1.00 |

Cost: $0.38 for the pilot, $4.20 for two suite runs, $0.77 for sabotage.

The table shows the second suite run, after review tightened the preservation graders (`no-css-fixes`, `only-copy-changed`). The first run scored 0.89 against 0.67. Sabotage ran before that change, and its score excludes `skill-fired`, which `--ablation none` counts.

Graders that separate the arms over both runs, with-arm against without-arm:

- `avatar-fix`: 6/6 against 2/6.
- `text-column-fix`: 6/6 against 4/6.
- `locates-fix`: 6/6 against 3/6. It was widened afterwards to accept `linhas N`, so this gap may be smaller than it looks.

Both arms find the obvious breaks alone: `one-word-name`, `pluralization`, `empty-list`, `number-format`. The skill adds fixes that can be applied as written.

`worst-case-rendered` is a proxy: it matches a `Write` to an HTML file that names the worst case, so it does not prove a working toggle, and a toggle added with `Edit` reads as a miss. The with-arm hit it in 3 of 7 runs, pilot included, and the without-arm in 0 of 6. Excluding it, `Δ` on the second run is +0.11.

**Verdict: patch.** The with-arm misses `worst-case-rendered`, which the rules count as a failed case, even though every report grader passes and sabotage goes red. Next, add a case whose prompt asks to see the breaks on screen. If the with-arm still skips Phase 3, drop the toggle from the local description.

Not measured: `<component> + fix`, `fix all`, `data only`, and any project with a dev server. The runs had no browser, so every finding comes from reading the code.
