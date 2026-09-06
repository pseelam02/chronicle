# CLI reference

`chronicle [repository] [options]`. The executable name is `chronicle`; intended npm scope is `@pseelam/chronicle`.

| Option                 | Behavior                                                                                    |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| repository             | Local directory, defaults to `.`; nested directories resolve to Git root                    |
| `--ref <ref>`          | Reachable history starting at the selected commit/ref; default `HEAD`                       |
| `--port <0–65535>`     | Bind `127.0.0.1`; 0/default requests an available OS port                                   |
| `--no-open`            | Suppress browser launch; print a private session URL                                        |
| `--force`              | Bypass cached index and rebuild                                                             |
| `--no-ai`              | Disable provider synthesis regardless of environment                                        |
| `--model <name>`       | Override `OPENAI_MODEL`; default `gpt-4.1-mini`                                             |
| `--checkpoints <2–50>` | Historical sampling limit, default 12; ref tips and worktree/index snapshots are additional |
| `--demo`               | Load bundled precomputed synthetic history; no Git repository needed                        |
| `--help`               | Print usage and exit successfully                                                           |
| `--version`            | Print package version and exit successfully                                                 |

Unknown switches, multiple repository paths, missing values and invalid numeric values are rejected. Startup errors set a nonzero exit status. Worker errors remain visible in the browser until Ctrl+C. SIGINT/SIGTERM terminate worker threads and active sockets. Explicit port collisions do not silently move to another port.

The default browser opener is `open` on macOS, `xdg-open` on Linux and `rundll32 url.dll,FileProtocolHandler` on Windows. No shell is used. Headless machines should use `--no-open`. Do not expose the loopback port through a public tunnel.

The process reads `OPENAI_API_KEY` and `OPENAI_MODEL` only from its environment; it does not load repository `.env` files. Cache locations use standard OS environment conventions. Missing optional keys never prevent local analysis.
