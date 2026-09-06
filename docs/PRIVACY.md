# Privacy and threat model

## Default behavior

Git inspection, parsing, indexing and browser serving happen on your computer. No telemetry or analytics exists. No hosted account, GitHub token or OpenAI key is required. Repositories with private remotes, non-GitHub remotes or no remotes work locally. Chronicle never clones, fetches, installs target dependencies, executes target source/scripts, checks out commits, writes the Git index, changes branches or edits the target working tree. Git optional locks, fsmonitor, external diff, textconv and lazy object fetch are disabled for analysis calls. Missing partial-clone objects must already be available locally.

The app does not load external fonts or scripts. Clicking the explicit GitHub product link is ordinary browser navigation and does not carry the session token. The CLI optionally invokes the OS browser opener with a loopback URL.

## Local server boundary

The server binds exclusively to `127.0.0.1`. Each launch generates a 256-bit random session token, passed in the URL fragment (not sent in HTTP requests), immediately removed from the address bar and retained in tab-scoped sessionStorage. API requests carry a Bearer header. Host, Origin and cross-site fetch checks resist DNS rebinding and cross-site requests. No CORS access is granted. CSP blocks external connections/resources and framing. Responses use no-store and no-referrer.

`--no-open` prints a private session link to your terminal so you can open it yourself. Do not share that link or terminal output. The application does not log requests or authorization headers. Sessions remain available across refreshes in the same tab. Restarting the CLI invalidates the old token; open the new link.

Static routes are allowlisted; there is no arbitrary file endpoint. API routes expose only the repository selected at process launch and known commits/checkpoints. Git commands use argument arrays without a shell. Worktree reads enforce canonical root containment and reject symlinks and oversized files. Metadata is rendered as text through React. Analysis occurs in memory-limited workers, and stream/synthesis/checkpoint concurrency is bounded.

## Optional OpenAI

Chronicle never reads `.env.local` or other environment files from an analyzed repository. A developer may explicitly load an environment file into the Chronicle process. The key remains server-side and is never included in the app, responses, cache or package. `--no-ai` blocks synthesis even if a key exists.

The only provider request is an explicit click on “I consent — send this evidence” after the evidence preview. The server sends at most eight selected evidence records: evidence ID, commit SHA, bounded subject, author, file path, line, historical name, claim, confidence and evidence classification. It does not send source bodies, the whole repository, full diffs or remote URLs. The preview is retrieved from the same server function used to construct the provider payload.

Requests go to the official OpenAI endpoint using the official SDK and Responses API, with `store:false`, a configurable model, one bounded retry, a 15-second SDK timeout and a 20-second total abort signal. Responses use a strict JSON schema, are bounded in size, and claims without valid supplied evidence IDs are discarded. Citation validation does not establish semantic truth: synthesis is always interpretation, never primary evidence. Provider handling remains subject to the user's OpenAI account/data policy.

Errors expose generic classifications, not SDK raw errors, headers or keys. Mocked tests are the normal suite. `npm run test:live-ai` explicitly uses only the bundled synthetic history and never analyzes private user source.

## Cache and residual risk

Cache files contain historical names, paths, signatures, commit metadata and graph relationships. Treat them as private repository data. Directories are created with owner permissions where supported; files use mode 0600. Windows ACLs are inherited from the user's local app data directory. Writes are atomic; malformed/truncated data triggers rebuilding. There is no encryption at rest beyond your OS disk protections.

Delete Chronicle's cache directory through your file manager with the CLI stopped. Locations are listed in the README. Cache deletion does not modify the repository. An abrupt OS crash can leave an unused `.tmp` file; such files are never loaded.

This is not a sandbox against another process already running as your OS user, a malicious browser extension, a compromised Git executable, or an attacker able to mutate files between permission checks and reads. Symlink checks reduce accidental traversal but cannot provide race-free OS isolation. Git config includes are read by Git; hooks, external diff/textconv, optional writes and environment repository overrides are disabled, but Git itself must be trusted and updated.
