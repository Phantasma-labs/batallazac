# La Toma de Zacatecas

Read `HANDOVER.md` first (current state, what is and is not in git, how to deploy safely), then `README.md`.

- Never run `npm run deploy` before reading the Deploy section of `HANDOVER.md`: the films are served from R2 by the Worker.
- The service worker (`src/pwa/sw.ts`) has its cache rules in the PWA section of `README.md`; a change to it must be re-checked offline in a real browser, not only by `npm test`.
- The repo is public: no secrets, tokens or account ids.
- Check with `npm test` and `npm run typecheck` before committing.
