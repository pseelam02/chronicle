# Validation report

Validated on 2026-09-05. Chronicle is prepared for review; no npm publication or PR merge was performed.

## Automated checks

| Check                                        | Result                                                                                                                        |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Prettier formatting                          | Pass                                                                                                                          |
| ESLint                                       | Pass                                                                                                                          |
| TypeScript strict type check                 | Pass                                                                                                                          |
| Production esbuild builds                    | Pass                                                                                                                          |
| Unit / integration / security / runtime      | 26 tests pass                                                                                                                 |
| Chromium end-to-end suites                   | 2 scenario suites pass                                                                                                        |
| Clean npm tarball install                    | Pass; production assets and executable operate outside source checkout                                                        |
| Packed browser flows                         | Demo and private synthetic checkout, desktop/mobile, refresh, timeline, comparisons, evidence, impact, shutdown pass          |
| Live OpenAI integration                      | Pass; local CLI/server consent boundary, provider authentication, four cited structured claims and key-free browser responses |
| Git history and production secret scan       | Pass                                                                                                                          |
| Production dependency audit                  | 0 reported vulnerabilities                                                                                                    |
| Node 22.23.2 and 24.20.0 local runtime smoke | 5 CLI/security/runtime tests pass on each                                                                                     |
| macOS, Ubuntu, Windows × Node 22/24 CI       | All six runtime jobs pass; separate Linux browser/packed-install job passes                                                   |

Cross-platform verification: [successful seven-job run](https://github.com/pseelam02/chronicle/actions/runs/33990332536). The PR checks show subsequent final-branch runs. An earlier Windows failure identified CRLF checkout conversion; `.gitattributes` now enforces LF and both Windows LTS jobs pass.

## Browser and MCP inspection

Playwright MCP was used against the real installed tarball in a separate temporary npm directory, not a development server. Inspected architecture, file/module filtering, symbol history, rename/move evidence, local commit viewer, compare, impact, search, empty results, timeline playback, refresh, mobile overflow and mock AI consent. The browser reported zero console errors/warnings after the favicon fix. The URL fragment was removed before screenshots.

A larger generated private fixture with 180 extra modules verified real parser/dependency/lineage/cache progress, the 100-node rendering cap, targeted search, staged changes, untracked contracts and local diffs. No fixture source was uploaded. Normal test and packaged flows exercised Ctrl+C-equivalent signal shutdown; an actual PTY launch exercised automatic OS browser invocation followed by Ctrl+C and confirmed the listening socket closed.

Mock AI browser testing confirmed **zero requests before consent and exactly one after consent**. The live test sends only selected evidence from the precomputed synthetic demo through the local API and the official OpenAI SDK. A separate mocked SDK test verifies timeouts and generic error redaction.

Screenshots remain outside Git in ignored `artifacts/`: `packed-demo-desktop.png`, `packed-demo-mobile.png`, `packed-fixture-desktop.png`, `packed-fixture-mobile.png`, plus MCP architecture/history/compare/impact/consent screenshots. CI uploads generated synthetic screenshots as the private **chronicle-browser-screenshots** artifact; see the Actions run or PR attachment link. Screenshots are not included in the npm package.

## Packaging

`npm run test:pack` builds and packs the allowlisted production assets, installs the tarball into a newly created directory with lifecycle scripts disabled, launches the installed executable with its working directory inside that installation, verifies help/version, and runs real browser flows against demo and a generated checkout. It then stops servers and removes installation/fixture directories. Runtime dependencies resolve from that clean installation. Only the package tarball and screenshots are retained under ignored `artifacts/`.

The final archive is `artifacts/pseelam-chronicle-0.1.0.tgz`; the final handoff records its exact size. README and package metadata are included, so documentation edits can change archive size without changing the runtime. No credentials, target fixtures, caches, source workspace paths or development dependencies are packed.

## Limits of this validation

Chromium is automated; Safari/Firefox are not separately certified. The tested Windows/Linux runtime and browser CI does not exercise every desktop browser opener. The architecture is syntactic and sampled, not a complete semantic proof. Split/merge candidates, first-observed history, branch playback, missing-test indicators and AI interpretation retain the explicit limitations in README and the architecture/privacy documents. No real private user source is sent to OpenAI.
