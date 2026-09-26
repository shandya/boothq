Continue building BoothQ.

1. Open `docs/IMPLEMENTATION_PLAN.md` and find the first phase that still has unchecked tasks. $ARGUMENTS
2. Re-read the docs that phase lists, plus `CLAUDE.md`.
3. Before writing code, give me a short plan (10 bullets max) and any questions where the docs are unclear or conflict. Wait for my OK.
4. Implement the tasks in order. Tick each checkbox in `IMPLEMENTATION_PLAN.md` as you finish it. Commit after each task.
5. Run `pnpm lint`, `pnpm typecheck`, and `pnpm test`. Fix failures before continuing.
6. Check the phase's acceptance criteria. For anything that needs a real phone or a human, write exact steps for me.
7. Finish with a report: what was built, how I verify it by hand, any doc changes, and open questions.
