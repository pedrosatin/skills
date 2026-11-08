# mobile-native eval verdict

Date: 2026-11-08. Claude Code 2.1.319, child session default model. 3 runs per arm, `-j 2`, `--allow-tools Write Edit`. The without-arm is a plain prompt with the same text. Measured on upstream `5206a950b715` with the local description overlay.

| Case | WITH | W/OUT | Δ | Sabotaged |
|---|---|---|---|---|
| phone-feel-audit | 1.00 | 0.94 | +0.06 | 0.89 |
| phone-feel-fix | 1.00 | 1.00 | 0.00 | 1.00 |
| desktop-tweak-guard | 1.00 | 1.00 | 0.00 | 1.00 |

Cost: $0.25 for the pilot, $1.70 for the first suite, $3.65 for two versions of `phone-feel-audit`, $2.33 for sabotage.

`phone-feel-audit` reads 0.86 and +0.14 in its run log. Two graders were false reds, confirmed in the kept traces and fixed here: `no-ungated-hover` matched a CSS comment, and `code-no-autocapitalize` rejected `autocapitalize="characters"`, a fair choice for a group code. The 0.94 recomputes the three without-arm runs with those fixes; the suite was not rerun. The 0.89 sabotage score is as logged, before the fixes.

An earlier version of this case split the CSS across four files and showed +0.18. Its safe-area graders read only the file where the padding was expected, so that gap is not evidence. The current version uses one CSS file and grades each rule.

The only gap left is `keyboard-resizes-layout` (3/3 against 0/3), one viewport attribute the skill states outright, and a grader that matches the skill's own text is discounted. Without the skill, every run gated hover, chose `dvh` and `svh` per element, padded the safe areas, and set input sizes and keyboards.

**Verdict: kill.** `Δ` is under 0.1 on every branch, which reads as zero at three runs per arm. The model does this work alone when asked for it. A rerun on a weaker model could change the answer.

Not measured: the Baseline section for new apps, and anything that needs a real phone. Every grader reads the files, so none of them proves the page behaves on hardware.
