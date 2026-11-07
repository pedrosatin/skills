# Homes for a review lesson

Lowest rung first. Each example is illustrative, not taken from a real review.

## Test or lint rule

The lesson is a behavior or a code shape a machine can check.

- Escaped bug: an empty cart crashed checkout. Add the failing test case beside the existing cart tests.
- Repeated comment: "don't call `Date.now()` in a reducer". Add a `no-restricted-syntax` rule scoped to reducers.

## Hook or CI check

The lesson concerns a change as a whole, or a step people skip.

- A migration shipped without its rollback. Add a CI step that fails when a file under `migrations/` lacks a paired down file.

## `REVIEW.md`

The lesson needs judgment, so no check can decide it, but it matters only during review. `REVIEW.md` sits at the repo root and says what deserves a comment there: failure modes, each with file and line. "No issues" is a valid outcome. Keep it to what the code cannot show.

- False positive: the reviewer keeps flagging `any` in generated clients. Add: "`src/generated/` is generated; skip it."
- Escaped bug: a retry was added to a non-idempotent call. Add: "Retries on `POST /payments` need an idempotency key."

## Skill

The lesson is a multi-step procedure used in one kind of work, not a rule. Patch the skill that owns that work before writing a new one, and prove the change with `../../skill-eval/SKILL.md`.

- Reviews of robot changes keep missing selector drift. Add the check to the robot review workflow.

## `AGENTS.md` line

Last resort: the lesson applies to writing code in every task in that repo, and nothing above can hold it. Every session pays for this line.

- "Money values are integer cents; never floats."

## Worked example

Fixture for trying the skill without a real PR.

The diff adds `const items = cart.items.filter(Boolean)` to `src/checkout.js:14`; `cart` can be `null` for guests. The review said "no issues", and the crash reached staging.

1. Classify: escaped bug. `src/checkout.js:14` dereferences `cart`, which is `null` for guest sessions.
2. Home: a test. The rule is a behavior, so rung 1 expresses it and nothing higher is needed.
3. Guard: a test that calls checkout with a guest session.
4. Proof: the test fails on the diff with `TypeError: Cannot read properties of null`, and passes once `cart?.items ?? []` lands.
