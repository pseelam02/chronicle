# Chronicle

**Your code, through time.** A local-first Git time machine for TypeScript repositories. Explore architectural snapshots, follow declarations through refactors, compare local states, and investigate the history behind code—all in your browser.

Chronicle runs entirely on your computer. Private repositories, offline checkouts and repositories without remotes are first-class inputs. No hosted backend, database, Docker, account or API key is required.

## Run

This release is prepared but **not yet published to npm**. After publication:

```sh
npx @pseelam/chronicle .
```

To run the built checkout now:

```sh
npm ci
npm run build
node dist/cli.js . --no-ai
node dist/cli.js --demo
```

To install the prepared tarball:

```sh
npm install -g ./artifacts/pseelam-chronicle-0.1.0.tgz
chronicle /path/to/repository --no-ai
```

Chronicle opens your default browser, shows actual analysis stages, and remains available through browser refreshes. Press Ctrl+C to terminate workers, streams and the server. The target repository is never checked out, changed, installed or executed. Node.js 22+ and Git on PATH are required; see [platform support](docs/PLATFORMS.md).

## Commands

```sh
chronicle .                              # Current checkout
chronicle /path/to/repository             # Another local repository
chronicle . --ref main                    # History reachable from a ref
chronicle . --port 4317                   # Explicit loopback port
chronicle . --no-open                     # Print private browser session link
chronicle . --force                       # Rebuild cached index
chronicle . --no-ai                       # Disable all provider synthesis
chronicle . --model gpt-4.1-mini           # Optional synthesis model
chronicle . --checkpoints 20              # 2–50 historical samples
chronicle --demo                          # Precomputed offline example
chronicle --help
chronicle --version
```

Omit `--port` to let the OS select an available port. An explicit occupied port produces a clear error. Nested repository paths resolve to the root. Invalid/empty repositories and unreadable history fail visibly. See [CLI reference](docs/CLI.md).

## Explore

- **Architecture:** search names and paths, filter declaration kinds or view files/tests, zoom/pan, fit view, and open a node inspector. Directory grouping and a minimap keep context. Large views show the first 100 matching nodes; search narrows the graph.
- **Timeline:** scrub by slider, arrow keys or checkpoint labels; play the evolution and inspect added, removed, changed and moved symbols. Branch/tag checkpoints and merge bases are included within configured limits.
- **Compare:** choose two snapshots, including HEAD, ref tips, merge bases, Staged and Working tree. Select an unsampled commit from local history for background analysis. Inspect symbol/relationship changes, complexity delta and a bounded local Git diff.
- **History:** inspect historical names/paths, checkpoint commit messages, authors, lineage confidence, dependencies and co-changing files. “Why does this exist?” is useful offline and explicitly separates Git evidence from inference.
- **Blast radius:** inspect changed files/declarations and their reverse dependency closure. Every item has an inclusion reason. Results are conservative risk indicators, not proof that a test or route will fail.

The synthetic `orbit-commerce` demo illustrates introduction, deletion, file extraction and renaming of pricing code. It uses the production interface and model, with no credentials or network.

## Privacy and optional OpenAI

All normal analysis is local. Git commands use argument arrays and read-only operations; repository dependencies and scripts are never executed. The server binds only to `127.0.0.1`, APIs require a random per-launch token, and cross-origin requests are rejected. There is no telemetry and no automatic provider call.

If you explicitly supply `OPENAI_API_KEY` in the CLI process environment, the inspector offers **Preview evidence to send**. Only clicking **I consent — send this evidence** contacts OpenAI. The preview contains the exact bounded records sent: selected commit subjects, authors, SHAs, paths, names, line numbers and historical claims—not full source or an entire repository. `OPENAI_MODEL` or `--model` controls the model. `--no-ai` disables this completely.

Chronicle does not auto-load environment files from the target checkout. For development only, you can explicitly run `node --env-file=.env.local dist/cli.js --demo`. Never put a key in browser code or commit it. AI output is labeled synthesis; citation IDs are validated, but semantic correctness still requires reviewing the supplied Git evidence. Full details: [privacy and threat model](docs/PRIVACY.md).

## Cache

Indexes stay outside the analyzed repository:

| OS      | Location                                            |
| ------- | --------------------------------------------------- |
| macOS   | `~/Library/Caches/chronicle`                        |
| Linux   | `$XDG_CACHE_HOME/chronicle` or `~/.cache/chronicle` |
| Windows | `%LOCALAPPDATA%\chronicle\Cache`                    |

Keys include canonical repository identity, HEAD, refs, staged state, relevant dirty file contents, analyzer/schema version, TypeScript version, selected ref and checkpoint configuration. Writes are atomic and corrupt entries are ignored. `--force` rebuilds. To delete cache data, stop Chronicle and remove only this `chronicle` cache directory with your file manager. Cached signatures and commit metadata are private data; they inherit your OS account security.

Snapshots represent the checkout at analysis time. Restart with `--force` after further edits; continuous watching is not implemented.

## Development and validation

```sh
npm ci
npx playwright install chromium
npm run build
npm run dev                  # Build and open a local demo server (no auto-open)
npm run format:check
npm run lint
npm run typecheck
npm test                     # Unit, integration, security and CLI runtime suites
npm run test:e2e             # Chromium desktop/mobile workflows and AI mocks
npm run test:pack            # Pack, clean install, browser workflows, cleanup
npm run test:live-ai         # Explicit synthetic-only live provider check
```

The normal automated suite mocks OpenAI. The live command reads a developer `.env.local` explicitly or uses the existing environment; it never sends private fixture/source content. Browser screenshots and tarballs stay in ignored `artifacts/`. Packaging tests install with lifecycle scripts disabled and isolate inherited npm configuration.

See [architecture](docs/ARCHITECTURE.md), [release instructions](docs/RELEASING.md), and [validation report](docs/VALIDATION.md).

## Honest boundaries of 0.1

TypeScript and TSX only. Imports resolve relative module paths, not full tsconfig aliases or external packages. Calls and type relationships are syntactic, not a complete semantic program analysis; dynamic dispatch and shadowing can remain uncertain. API routes recognize exported HTTP-method handlers. Complexity is an approximate syntactic indicator.

History is sampled (up to 2,000 commits, 1,500 TS files/snapshot, 1 MB/file). First observed at a checkpoint is not necessarily exact introduction. Split/merge ancestry is a low-confidence candidate, not guaranteed identity. Independent branch checkpoints are comparisons, not a perfect linear narrative. Submodules, Git LFS/partial-clone downloads, bare/empty repositories, non-UTF-8 filenames and continuously changing worktrees are outside the tested scope. Git diff output is truncated at 120,000 characters. No remote-specific commit links are needed; the internal viewer works offline.

Roadmap: semantic TypeScript resolution, richer lineage and historical lookup, larger graph virtualization, persistent per-blob reuse and Python/Go/Rust analyzers sharing the same temporal model.

MIT licensed. No npm publication has been performed.
