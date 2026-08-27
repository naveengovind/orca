# Orca fork — code-server / Devin embedded tabs — HANDOFF

Written 2026-08-25. This doc lets a fresh Claude thread continue this work without
re-discovering everything. Read it fully before touching code.

## TL;DR

We forked `stablyai/orca` to `naveengovind/orca` and added **chromeless embedded
web-app tabs**: a keypress opens code-server (or Devin Cloud) inside an Orca browser
tab with **no browser toolbar/URL bar**, rendered by a **client-local** webview even
when connected to a remote Orca server. Goal = full-LSP diff review (and Devin) inside
Orca without an external editor.

- **Repo:** https://github.com/naveengovind/orca  **Branch:** `code-server-tab`
- **Latest release:** `code-server-tab-b10` (unsigned macOS arm64). All older releases deleted.
- **Working tree = exactly b10** right now (HEAD `69ab8c6c0`). Clean.
- There is **stashed WIP** (`git stash list`) the user asked to set aside — see “Stashed WIP”.

## Environment (this VM: `nav-machine`, GCP, Ubuntu 22.04, x86_64)

- Fork clone: `~/orca-fork`. Node 24 + pnpm 10.24 via nvm: `source ~/.nvm/nvm.sh && nvm use 24`.
- **Repo formats with `oxfmt`, NOT prettier.** Never run prettier — it mangles the whole file
  and blows the max-lines ratchet. Use `pnpm format` (oxfmt) or hand-match style.
- code-server runs locally on `127.0.0.1:13337` (`--auth none`). Shell helpers `cs`/`csv` in
  `~/.zshrc`. Settings in `~/.local/share/code-server/User/settings.json`.
- A headless `orca serve` runs as a **user systemd unit** `orca-serve.service` on `:6768`
  (tailnet `100.127.243.48`). Leave it running — the user's desktop is paired to it.
- **Kasm VNC** desktop is on `DISPLAY=:1` (KasmVNC, web on :8444). This is how the user views
  the dev app. `/dev/dri/renderD128` exists (real GPU) — do NOT force `LIBGL_ALWAYS_SOFTWARE=1`
  unless needed; it blocklists WebGL and breaks bot-check pages.
- Memory file: `~/.claude/projects/-home-naveen-paraform-com/memory/orca-serve-and-code-server-review-stack.md`.

## What's built (all committed, in b10)

**Two chromeless tab types**, each wired through the *entire* creation chain:

| Feature | Keybinding (default) | Menu label | Settings URL key | Default URL |
|---|---|---|---|---|
| code-server | `Mod+Shift+C` | “New Code Server” | `codeServerUrl` | `http://127.0.0.1:13337` (opens `?folder=<worktree path>`) |
| Devin Cloud | `Mod+Alt+D` | “Devin (Cloud)” | `devinCloudUrl` | `https://app.devin.ai` |

(`Mod` = Cmd on macOS, Ctrl on Linux/Win. Both rebindable in Settings → Keyboard Shortcuts.)

Behavior:
- **Chromeless**: `chromeless` flag on `BrowserWorkspace` (`src/shared/browser-workspace-types.ts`)
  suppresses the toolbar row in `browser-page-pane.tsx`.
- **Client-local even on remote servers**: the tab is always materialized with
  `browserRuntimeEnvironmentId: null` (a local Electron webview). Requires the app's port to be
  reachable locally — for a remote host, an SSH forward of 13337 (or `tailscale serve`).
- **Origin-scoped reuse**: pressing the key reuses that app's existing tab per worktree (matched
  by URL origin) instead of stacking new ones. code-server and Devin keep separate tabs.
- **Configurable URLs**: Settings → Browser has two rows (shared `EmbeddedAppUrlSetting.tsx`),
  right after “Default Home Page”. Empty → default.
- **Keyboard passthrough (FULL, since b11)**: a focused chromeless guest owns the ENTIRE
  keyboard — every chord (Cmd+P/J/T/W/F, Ctrl+Tab, zoom, tab chords, all of it) reaches the
  page; none reach Orca. Orca chrome stays reachable by mouse (tab strip, right-click ▸ Reload).

Feature commits (on top of upstream merge `de73dbfe8`):
`4cfdfec43` local render on paired-runtime · `7814cbf4b` chromeless keeps browser chords ·
`ae02edd55` searchable menu + configurable code-server URL · `f48338d8c` wire into tab-group strip ·
`69ab8c6c0` Devin + generalized/configurable URLs.

## Architecture — where the wiring lives (READ THIS; it caused a real bug)

**Orca has THREE places that create tabs.** A new tab-creation action must be threaded through
ALL of them or it silently won't appear:
1. `src/renderer/src/components/Terminal.tsx` — global keydown + its `TabBar` (portal bar).
2. `src/renderer/src/components/tab-group/` — `TabGroupPanel.tsx` + `useTabGroupCreationCommands.ts`.
   **This renders the visible split tab strips.** The original code-server item didn't show up for
   a whole build because it was only wired into Terminal.tsx, not here. (`f48338d8c` fixed it.)
3. `src/renderer/src/components/floating-terminal/FloatingTerminalPanel.tsx` — floating workspace
   (not wired for these features; chromeless is worktree-scoped).

The menu itself has two forms, BOTH need the item:
- **Static list**: `tab-bar-static-create-menu.tsx`.
- **Searchable options** (the “+” menu has a search box): `tab-create-menu-options.ts` (option +
  `hasNewX` context flag) + `use-tab-bar-create-menu-controller.ts` (handler + context) +
  `tab-create-menu-option-select.ts` (dispatch switch) + `TabBarCreateEntryRow.tsx` (icon).

Full chain for a new action (`onNewXTab`): store slice action (`store/slices/browser.ts`,
helper `openChromelessAppTabInActiveWorkspace`) → `tab-bar-props.ts` (optional prop) → the 3
render sites above → `use-tab-bar-runtime-model.ts` (shortcut label) → `tab-bar-surface.tsx`
(thread label) → static + searchable menu → keybinding in `src/shared/keybindings.ts` → global
keydown in Terminal.tsx → guest-webview chord forwarding in
`src/main/browser/browser-guest-shortcut-dispatch.ts` (so it works while the webview is focused) →
IPC: `preload/index.ts` + `preload/api/ui-command-event-api.ts` + web stub `web-ui-api.ts` +
`hooks/ipc-events/content-creation-ipc-bridge.ts` → settings visibility gates
`shortcut-row-visibility.ts` + `shortcuts-search.ts`.
Persisted setting: `store/slices/ui.ts` + `shared/persisted-ui-state-types.ts` +
`main/runtime/rpc/methods/client-ui-schemas.ts`.

## Build / verify / release

```
source ~/.nvm/nvm.sh && nvm use 24
cd ~/orca-fork
pnpm install --frozen-lockfile        # after upstream merges
pnpm typecheck                        # all 3 tsconfig projects
pnpm run sync:localization-catalog    # after adding any translate('auto.…') key
pnpm lint                             # FULL gate: oxlint + max-lines ratchet + localization + more
pnpm test --config config/vitest.config.ts <paths>   # or: npx vitest run --config config/vitest.config.ts <paths>
```

Gotchas learned the hard way:
- **max-lines ratchet**: files are capped at 300 (tsx) lines; you may NOT add a `max-lines` disable
  or bump. If a file goes over, SPLIT it (that's why `tab-create-menu-option-select.ts` and
  `tab-create-agent-launch.ts` exist).
- **Localization**: any new `translate('auto.x.y', 'text')` must be added to `en.json` via
  `pnpm run sync:localization-catalog`, or `verify:localization-*` fails lint.
- Test fixtures for `TabCreateMenuOptionsContext` must include every `hasNewX` flag (typecheck fails otherwise).

### Cut a macOS arm64 release (CI, from the pushed branch)

```
git push
gh workflow run fork-mac-arm64-release.yml --repo naveengovind/orca --ref code-server-tab
gh run watch <run-id> --repo naveengovind/orca --exit-status
```
- Workflow file: `.github/workflows/fork-mac-arm64-release.yml` (also registered on fork `main` so
  `gh workflow run` can find it). Runner **must be `macos-15`** (Swift 6 for `computer-use-macos`;
  macos-14 fails). Build uses `electron-builder … --mac --publish never` (the config's publish
  section otherwise tries to push to the upstream feed and dies on a missing token). It uploads
  only `*arm64*` dmg/zip and creates a prerelease `code-server-tab-b<run#>`.
- **CI builds the PUSHED branch, not your local tree.** Uncommitted local changes are NOT in the
  release. Commit + push first.
- Install on Mac: download dmg → drag to /Applications → `xattr -dr com.apple.quarantine /Applications/Orca.app`
  (unsigned). If still blocked: `codesign --force --deep -s - /Applications/Orca.app`.

### Live-debug the dev app in Kasm (very useful, cheap)

```
DISPLAY=:1 pnpm dev > /tmp/orca-dev.log 2>&1 &     # window appears in Kasm VNC (:1)
grep "Remote debugging on" /tmp/orca-dev.log       # e.g. http://127.0.0.1:9345  (CDP)
```
Then Playwright over CDP (run from repo root so `playwright-core` resolves):
```
node -e '(async()=>{const {chromium}=require("playwright-core");
const b=await chromium.connectOverCDP("http://127.0.0.1:9345");
const p=b.contexts()[0].pages().find(x=>x.url().includes("5173"));
await p.getByRole("button",{name:"New tab"}).first().click(); …})()'
```
Renderer-only edits hot-reload; **preload/main edits need a dev restart**
(`pkill -f "orca-fork/node_modules/.pnpm/electron"` then relaunch). A big HMR wave can wedge the
renderer — restart if the page goes blank.

## KNOWN ISSUES / TODO

1. **FIXED (b11): full keyboard passthrough for chromeless guests.** Commits `4598818c6` +
   `a11ed203b` (option (a) from the old plan, user-confirmed):
   - `forwardGuestShortcutInput` returns false at the top for chromeless guests; Ctrl+Tab and
     native zoom-changed are also guarded in `browser-guest-shortcut-forwarding.ts`.
   - TWO real bugs made the flag itself unreliable (found live via CDP — Orca kept opening its
     own "Go to file" on Ctrl+P even with the dispatch fix):
     1. `workspace-session-browser-schema.ts` (zod) stripped the unknown `chromeless` key, so
        EVERY restart dropped the flag from restored tabs (they regrew the toolbar too).
     2. Guest registration captured `chromeless` at webview attach — before store hydration —
        and the attach effect deliberately never re-runs. Now registration reads a
        `chromelessRef` and a new `browser:setChromeless` IPC re-asserts on change.
   - Tabs saved by b10-or-earlier builds already lost the flag; close + reopen the app tab once
     (the chord creates a fresh chromeless tab because reuse only matches chromeless ones).
   - Verified live over CDP (fresh tab AND restored session): Ctrl+P opens code-server's Quick
     Open, no Orca overlay. Tests: `browser-guest-shortcut-dispatch-chromeless.test.ts`,
     `browser-guest-shortcut-forwarding.test.ts`, `workspace-session-schema.test.ts`.

2. **Devin Cloud bot-check** (“Failed to verify your browser — Code 11”, Vercel Security
   Checkpoint): the user says the WEB-BYPASS side is now working — **do not work on anti-detection
   / bot-bypass.** If it recurs, the non-bypass levers are: test on the Mac (real GPU, not VNC
   software-GL), switch the tab's browser profile UA mode to `native`, or import the user's Chrome
   session cookies (Settings → Browser → session profiles → import).

## Local browser rendering preference (added after b12)

Settings → Browser → **"Open Browser Tabs Locally"** (`browserPreferLocalRendering`, persisted
ui state, default OFF). Electron-only: when ON, user-created browser tabs materialize as
client-local webviews even when the paired runtime supports browser streaming. Single control
point: `preferLocalBrowser` arg in `resolveClientCreationActionPolicy`
(`src/renderer/src/lib/client-creation-action-policy.ts`) — every creation entry point
(new-tab chord, + menu, Cmd+J, link opens, duplicates) consults that policy. Existing
remote-owned tabs stay remote (ownership checks are separate); the paired-web client ignores
the preference (it cannot render locally). Remote-host-only pages (VM localhost ports) need a
port forward when rendered locally.

## Stashed WIP (set aside 2026-08-25 per user)

`git stash@{0}` = "anti-detection web bypass + full-keyboard chromeless". Contains: further
`anti-detection.ts` tweaks + injection wiring with debug `console.log`s in `browser-manager.ts`
(would fail lint), AND the **option-(a) full-keyboard change** to the guest dispatch/forwarding.
The user asked to **ignore the anti-detection work for now**. If you implement the Cmd+P fix fresh,
you may cherry-pick just the keyboard hunks from the stash or rewrite them; do NOT ship the
`console.log`s. `git stash show -p stash@{0}` to inspect.

## Upstream sync

`stablyai/orca` merges ~150 PRs/day; keep the diff minimal so rebases are cheap.
```
git fetch https://github.com/stablyai/orca main && git merge FETCH_HEAD --no-edit
pnpm install --frozen-lockfile && pnpm typecheck && pnpm lint
```
Last merge: `de73dbfe8`.
