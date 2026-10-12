---
name: research
description: Investigate a question against high-trust primary sources and capture the findings as a Markdown file in the repo. Use when the user wants a topic researched, docs or API facts gathered, or reading legwork delegated to a background agent.
---

Spin up a **background agent** to do the research, so you keep working while it reads.

Its job:

1. Investigate the question against **primary sources** (official docs, source code, specs, first-party APIs), not a secondary write-up of them.
2. Write the findings to a **single Markdown file**. Every claim cites the source that owns it.
3. Save the file where the repo already keeps research notes. If there is no convention, write `.scratch/research/<slug>.md`. Tell the operator the path.

Done when every claim has a primary source, the file is written, and the path is reported.
