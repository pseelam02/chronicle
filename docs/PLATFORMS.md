# Supported platforms

The runtime targets Node.js 22 and newer, with Node 22/24 as the LTS compatibility targets. Git must be installed and discoverable on PATH. The browser application targets current Chromium, Firefox and Safari features, with automated browser tests in Chromium.

macOS, Linux and Windows use Node APIs, argument-array Git invocation, native path handling, OS cache conventions and platform-specific browser openers. No native compilation, Docker, database service or target-repository dependency installation is required.

Local verification passed on macOS arm64 with Node 26.4.0, plus CLI/security/runtime smoke suites on Node 22.23.2 and 24.20.0. GitHub Actions passed the full runtime suite on Node 22/24 across macOS, Ubuntu and Windows, plus Chromium and packed-install flows on Ubuntu. Platform support is not a claim that all OS/browser combinations were manually exercised.

Symlink and filename behavior is conservatively restricted. Worktree files must remain inside the canonical repository root. POSIX file modes apply on macOS/Linux; Windows relies on inherited user-directory ACLs. Paths with spaces are supported. Git's UTF-8 path output is assumed; unusual non-UTF-8 names may be omitted or fail to read.
