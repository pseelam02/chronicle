# Architecture

Chronicle is one npm package with four source areas. `packages/cli` owns argument parsing, the Node HTTP server, worker lifecycle and optional OpenAI requests. `packages/analyzer` inspects Git objects, parses TypeScript, selects snapshots, matches lineage and caches results. `packages/shared` defines the serializable graph model. `packages/web` is a React application compiled to static assets by esbuild.

The installed executable serves `dist/web` directly. It does not run a development server. TypeScript and OpenAI are regular pure-JavaScript runtime dependencies; React is bundled at build time. The demo is precomputed into `dist/demo.json`. There is no database daemon or native compilation.

## Analysis pipeline

1. Resolve and canonicalize a local Git root. Nested checkout paths are accepted; bare and empty repositories are not supported in this release.
2. Resolve the selected ref to an immutable commit, inspect up to 2,000 reachable commits, and enumerate local branches and tags.
3. Select up to 12 historical checkpoints by default (2–50 configurable), keeping the first/last observed commits, prioritized tags/merges and evenly spaced samples. Up to 20 ref tips and their merge bases are also available.
4. Read blob objects with `ls-tree` and `cat-file`; never checkout historical commits. Reuse AST results for unchanged path/blob pairs within the analysis run.
5. Parse TS/TSX declarations and dependencies. Source text is held in worker memory and is not included wholesale in the cached graph.
6. Match declarations between checkpoints, build explicit checkpoint membership indexes for node/edge IDs, and capture Git index and working-tree states.
7. Atomically save the index in the OS cache and send the result to the local server. Actual stages and file counts stream through authenticated SSE.

Selecting an unsampled commit in Compare starts a separate bounded worker, then adds that snapshot to the current session. Its ref must already exist in the process's discovered commit history. Only one additional checkpoint job can run at once. Arbitrary commands and repository paths are never accepted from the browser.

## Lineage

Same path and qualified declaration match first. Git rename detection plus the same qualified name produces a high-confidence move. Unique normalized AST fingerprints produce a heuristic rename/move match. Unmatched declarations get checkpoint-specific IDs. Ambiguous shared fingerprints are exposed as low-confidence split/merge candidates rather than merged identities. Confidence cannot increase beyond a previous uncertain match.

Normalized structure is used only for matching. A separate exact declaration hash detects implementation changes, including identifier-only changes. This distinction is covered by regression tests.

Lineage is not a proof of identity. Major simultaneous rewrites, overloaded declarations, structural duplicates, branch topology and splits/merges can remain unresolved. No specialized graph database is used: checkpoint snapshots plus node/edge membership indexes reconstruct the temporal graph.

## Relationships and impact

`defines`, `exports`, relative `imports`, recognizable test imports, identifier `calls`, type `depends on`, `extends` and `implements` carry evidence. Calls/type bindings use syntactic resolution with confidence below one; lexical shadowing and TypeScript path aliases are not fully resolved.

Blast radius starts from changed declarations and file content, follows reverse relationships, and conservatively includes declarations in affected files. Every included node has a reason. These are risk indicators, not guaranteed failures. Dynamic imports, reflection, runtime injection and non-TypeScript consumers remain outside the graph.

## Resource boundaries

History: 2,000 commits. TypeScript files: 1,500 per snapshot. File content: 1 MB per file. Worker heap: 768 MB. Git call: 30 seconds and 24 MB output. Browser graph: first 100 matching nodes and 100 visible symbol edges; search narrows the set. Additional session snapshots: capped at 80. Git diff display: capped at 120,000 characters. Cache read: 100 MB. Oversized/unsupported files generate coverage notes. These limits favor controlled failure and visible coverage over unbounded memory usage.

## Decisions and next steps

Node HTTP and workers keep installation small and portable. JSON snapshots keep persistence inspectable and avoid a native database requirement. TypeScript Compiler API handles real TSX syntax without installing dependencies from the target checkout. The restrained 2D graph emphasizes grouped architecture and evidence over force-directed decoration.

Future analyzers can implement the same FileNode/SymbolNode/Edge contract for Python, Go and Rust, with language-specific symbol matching. Future work includes semantic tsconfig resolution, richer many-to-many lineage, exact introduction lookup across unsampled history, disk-level per-blob reuse, topology-aware branch playback, continuous file watching and larger-graph virtualization.
