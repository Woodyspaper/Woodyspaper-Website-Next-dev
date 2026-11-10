---
name: Pushing imported workspace history
description: How to seed a separate GitHub development repository from an imported Replit workspace.
---

Imported Replit workspaces may be shallow clones. Pushing their current history into a new development repository can fail because required ancestors are missing locally. Fetch the source remote unshallow before retrying the push, then push only to the dedicated development remote and branch.

**Why:** A partial local commit graph can produce an incomplete pack that the new GitHub repository rejects.

**How to apply:** Before seeding a new dev repository from an imported Repl, check `git rev-parse --is-shallow-repository`; if true, fetch the original remote’s full history before pushing.
