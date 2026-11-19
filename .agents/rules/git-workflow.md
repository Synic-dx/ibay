# Git Workflow Rules

Always synchronize with remote before pushing:
1. **Always pull first**: Before pushing any commits or branches, run `git pull origin <current-branch>` (or `git pull origin master`) to incorporate teammates' latest changes.
2. **Verify integration**: Ensure tests and typechecks pass (`npm run typecheck`, `npm run lint`) after pulling.
3. **Push cleanly**: Once updated and verified, proceed with `git push`.
