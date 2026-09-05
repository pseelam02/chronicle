# Implementation ledger

1. Initialize private GitHub repository and focused commit workflow.
2. Build packaged CLI, secure loopback server and analysis worker.
3. Implement read-only Git inspection, TypeScript graphs, checkpoints, lineage and cache.
4. Build architecture explorer, timeline, comparisons, evidence and impact views.
5. Add optional consent-based OpenAI synthesis and synthetic offline demo.
6. Test security, analysis, browser flows and isolated tarball installation; document and open PR.

Decisions: npm, Node >=22, TypeScript compiler API, React, esbuild, Node HTTP and worker threads. The analyzed repository is never executed or modified. Bounded analysis favors honest partial coverage over invented results.
