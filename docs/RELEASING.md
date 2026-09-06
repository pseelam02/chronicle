# Release checklist

The package has not been published. The feature branch must be reviewed and merged by the owner; the agent does not merge or publish.

1. Review the PR, known limitations, license and privacy policy. Confirm npm ownership/permission for `@pseelam/chronicle` or change the package name and bin metadata before publication.
2. Run `npm ci`, `npx playwright install chromium`, `npm run build`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e` and `npm run test:pack`.
3. Optionally provide a server-side key and run `npm run test:live-ai` using only synthetic evidence.
4. Run `npm pack --pack-destination artifacts`, inspect the allowlisted content and size, and review the clean-install report. Do not add tarballs, `.env.local`, screenshots or caches to Git.
5. Merge the reviewed PR and create the intended version/tag according to your release policy. Update CHANGELOG and README publication status.
6. Authenticate to npm using your preferred trusted publishing/2FA flow. Verify `npm whoami` and scope permissions. Publish the reviewed tarball with `npm publish artifacts/pseelam-chronicle-0.1.0.tgz --access public` only when explicitly ready.
7. Verify `npx @pseelam/chronicle --version` and `npx @pseelam/chronicle --demo` from a clean directory.

The npm `files` allowlist contains only built runtime/browser assets, README, changelog and license. Runtime dependencies are TypeScript and the official OpenAI SDK. React and build/test tools are development-only. There are no package install lifecycle scripts; `prepack` builds production assets in the development checkout.
