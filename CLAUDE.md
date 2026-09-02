# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`pdf-unlock` is a zero-dependency Node.js CLI that removes password protection from PDF files (the correct password must already be known) by shelling out to the external `qpdf` binary. Originals are copied into a sibling `backup/` folder before being overwritten in place.

## Commands

Node 24 and pnpm, both pinned in `mise.toml` and `packageManager`. No build step and no lint config.

```bash
mise install                                # Node 24 + pnpm
pnpm install                                # no dependencies; keeps the lockfile in sync
pnpm test                                   # whole suite (37 tests)

node --test test/cli.test.js                # one file
node --test --test-name-pattern="backup"    # tests matching a name

# Run the CLI directly (fastest, no install)
node bin/pdf-unlock.js <file-or-folder> [-r] [-p <password>] [--dry-run]

pnpm link                                   # global `pdf-unlock`; pnpm 10 needs no --global
pnpm uninstall --global pdf-unlock          # remove it again

qpdf --version                              # hard prerequisite; brew install qpdf on macOS
```

Use pnpm, never npm or yarn. The test script needs the glob quoted (`node --test "test/**/*.test.js"`);
Node 24 treats a bare `test/` argument as a module path and fails with MODULE_NOT_FOUND.

## Architecture

Four production files, CommonJS, no `require` outside Node builtins.

- `bin/pdf-unlock.js` - hand-rolled arg parser (no yargs/commander), help text, the per-file loop, result counters, and exit codes. All console output and exit-code policy live here.
- `src/index.js` - the core: `collectPdfFiles` (file discovery) and `unlockFile` (backup + decrypt one file). Pure of console output.
- `src/checkQpdf.js` - probes `qpdf --version`, prints platform-specific install instructions on failure.
- `src/promptPassword.js` - masked stdin prompt built by monkey-patching `readline`'s `_writeToOutput`.

### Invariants worth preserving

- **Backup before write.** `unlockFile` copies the original to `<dir>/<backupDirName>/<basename>` first, and skips the copy if that path already exists (re-running never clobbers a good backup with an already-decrypted file).
- **Decrypt to temp, then rename.** qpdf writes to `.pdf-unlock-tmp-<pid>-<basename>` in the same directory; only a successful run renames over the original. Any failure unlinks the temp file and leaves the source untouched. Same-directory temp keeps the rename on one filesystem.
- **Never descend into the backup directory.** `collectPdfFiles` skips any directory named `backupDirName` at every level, so backups are never re-processed. Each directory level gets its own `backup/` folder.
- **Batch keeps going on failure.** A wrong password on one file reports `WRONG PW` and continues; the process exits 1 only after the whole batch.

### Tests

`node:test` only, no framework. Fixtures are real qpdf-encrypted PDFs in `fs.mkdtemp` directories, so
**the suite needs `qpdf` on the PATH**; `requireQpdf()` fails fast with an install hint when it is missing.

- `test/helpers.js` - fixture builders. Not a test file, which is why the glob is `*.test.js` rather than everything under `test/`. `writePlainPdf` hand-writes a minimal PDF then runs it through `qpdf --warning-exit-0` to repair the xref table; `isEncrypted` asserts on `qpdf --show-encryption` output.
- `test/collectPdfFiles.test.js` - discovery and backup-dir skipping. Uses cheap non-PDF stub files, since discovery never parses content.
- `test/unlockFile.test.js` - the backup, temp-file and error-classification invariants.
- `test/cli.test.js` - spawns `bin/pdf-unlock.js` as a real subprocess and asserts exit codes, stdout and the resulting files. This is the only coverage of arg parsing, the interactive prompt, and the Thai output strings, because `bin/` exports nothing.
- `test/checkQpdf.test.js` - runs child processes with `PATH=/nonexistent` to exercise the missing-qpdf branch.

Every assertion in these suites was mutation-checked: a deliberate break in the matching production line
was confirmed to turn the test red. One exception, worth knowing before you trust it: **`leaves no temp
file behind after a failed unlock` is vacuous against qpdf 12.3.2**, which deletes its own output file on
every failure mode reachable here (wrong password, corrupt PDF, truncated PDF). The `fs.unlinkSync(tmpPath)`
cleanup line in `unlockFile` is unreachable today, and that test guards observable behaviour rather than
that line.

### Error classification

`runQpdfDecrypt` never rejects. It resolves `{ ok, invalidPassword, message }`, and distinguishes a wrong password from any other qpdf failure by regex-matching `/invalid password/i` against stderr. Any change to that detection changes user-visible `WRONG PW` vs `ERROR` reporting.

## Conventions

- User-facing CLI strings and both markdown docs are **Thai**. Keep new user-facing output in Thai to match; code, comments, and identifiers stay in English.
- `qpdf` is always invoked through `execFile`/`execFileSync` with an argv array, never a shell string, so passwords and paths with spaces are safe. Do not switch to `exec`.
- Option defaults (`backup`, `backupDirName: 'backup'`) are declared in both `bin/` and `src/`; change both together.
- `--dry-run` is handled entirely in `bin/` (it exits before the loop). `unlockFile` also accepts a `dryRun` option, but nothing currently passes it.

## Known gaps

Documented in `HANDOFF.md`: never tested on Windows, on real bank PDFs, or on cloud-only Google Drive
files. Not published to npm, so `npx pdf-unlock` from the registry does not work yet. There is no CI, and
no git repository. Processing is strictly sequential with no concurrency.

Paths with spaces or Thai characters and passwords holding shell metacharacters are covered by
`test/cli.test.js` and no longer count as gaps.
