# Case recipes

Read after `claude plugin eval --help`. This holds what the help text and a first run do not reveal.

## By skill type

| Skill type | Prompt | Result grader | Red when |
|---|---|---|---|
| Gate (checks before an action) | The action, phrased as the operator would, with the flaw planted in a fixture | `regex` over a file holding the outcome | The flaw survives |
| Generator (produces a file) | The request plus its inputs | `regex` over the file; `llm` only for short output | A required part is missing |
| Reference (facts on demand) | A question only the skill answers | `regex` over `last_message` | The answer takes the model's default |
| Over-trigger guard | A near miss the skill must leave alone | `regex` showing the good content survived | The skill damages it |

Phrase prompts the way the operator types them and leave the skill's name out, so `skill-fired` tests the description.

For a user-invoked skill, the description cannot fire it, so the prompt must open with `/<folder>:<skill>`, where `<folder>` is the target folder's name. The expansion leaves no `Skill` call and no skill text in the trace, so grade only the result. The without-arm receives the same line as an unknown command and carries on with the rest of the prompt, which makes it a fair plain-prompt baseline.

## Graders

Add this to every case of a model-invoked skill. It is an indicator in a two-arm run and stays out of the score:

```md
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?<skill-name>"'
---
```

A near-miss case adds the inverse, scored in both arms. Its `Δ` stays near zero by design: it guards precision and adds nothing to the skill's lift. Save it as `graders/skill-stays-quiet.md`:

```md
---
type: tool_used
tool: Skill
input_match: '"skill"\s*:\s*"(?:[\w-]+:)?<skill-name>"'
max: 0
min: 0
arm: both
---
```

Grade state with a file. There are no custom-code graders, and `file_exists` and `target: files` see only files created during the run. Ask for the outcome in a named file and point a `regex` at it:

```md
---
type: regex
target: { source: file, path: commit-message.txt }
pattern: 'co-authored-by'
flags: i
match: not_contains
---
```

A grader on a missing file throws and fails, `not_contains` included, so a run that produced nothing cannot score as clean.

Traps that cost a run here:

- `tool_used` counts denied calls. To prove a command ran, match its output with a `regex` on `target: trace`, such as `'Ran [0-9]+ tests? in'`.
- `target: trace` includes the prompt, so a pattern taken from the prompt is always green.
- Paths overlap: `slug\.py` also matches `test_slug.py`. Anchor on `"file_path"\s*:\s*"[^"]*/slug\.py"`.
- `tool_used` watches one tool, so `max: 0` on `Edit` misses the same change made with `Write`. To prove a fixture file stayed the same, point a `regex` at it and match its whole content with `^...$`, without the `m` flag. That grades the final state; an attempt through `Bash` needs its own `tool_used` grader, for the reason in the Shell section.
- Short words match inside longer ones: `red\b` also matches `required` and `ignored`. Bound both sides: `\bred\b`.

## Fixtures

Keep a `fixture.sh` beside the case and name it in `case.yaml`:

```yaml
schema_version: "1.1"
name: <case>
context:
  scaffold_script: fixture.sh
```

The script runs outside the sandbox in an empty workspace, with a temporary `HOME`. It cannot supply skills or `.claude/` configuration: those do not load.

## Shell and Git inside a run

Granted `Bash` runs under the OS sandbox, which needs `bwrap` and `socat`. Inside it, on Linux with Claude Code 2.1.319, `/usr/bin/git` was masked with `/dev/null`: `git` exits 126 whatever the grant, while `git` in `fixture.sh` works. The eval docs imply otherwise, so recheck with one cheap probe after a Claude Code upgrade. Leave the mask in place, and for a skill about Git, grade the decision instead of the command: seed the staged paths or diff as text, tell the agent the operator runs the commit, and grade the message, command, or path list it writes.

The sandbox also mounts the workspace read-only for `Bash`, whatever the grant: `echo x >> file` and `sed -i` fail with `Read-only file system`, while `Write` and `Edit` reach the disk. A file a run must change therefore goes through those tools, and a `Bash` write leaves no trace in the file, so grade the attempt with `tool_used` on `Bash` and an `input_match` for the write forms.

Grant plain `Bash` when a case runs commands. A pattern such as `Bash(python3 *)` denies `python3 -m unittest; echo "exit=$?"`, and a skill that asks for the exit code then scores below a bare model for following its own instructions.

## Sabotage

Keep the frontmatter so the skill still fires, and replace the body:

```md
Nothing to check here. Proceed with the request as given.
```

Copy `evals/` along with the skill, without `evals/results/`. A with-arm score that holds up means the graders reward the model's default.

For a user-invoked skill, the copy's folder is `<name>-sabotaged`, so its prompts must open with `/<name>-sabotaged:<skill>`. Left at `/<name>:<skill>`, the line is an unknown command, the sabotaged body never loads, and the arm is a plain prompt that proves nothing about the skill. In the copy:

```sh
sed -i 's|^/<name>:|/<name>-sabotaged:|' evals/*/prompt.md
```
