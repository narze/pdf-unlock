---
name: pdf-unlock
description: Remove the password from an encrypted PDF so its contents can be read. Use when reading a PDF fails with "The PDF specified is password protected", when the user hands over a protected PDF plus its password (bank statements, payslips, invoices), or before processing a folder of protected PDFs.
---

# pdf-unlock

`pdf-unlock` strips password protection from PDFs whose password is already known, using `qpdf`. Each file is rewritten in place, and the encrypted original is kept in a `backup/` folder beside it.

## Before unlocking

- The password comes from the user. Ask for it - the tool decrypts with a known password and offers no recovery.
- `qpdf` must be on PATH: check with `qpdf --version` (`brew install qpdf`, or `sudo apt-get install qpdf`).

## Unlock, then read

Feed the password on stdin, which keeps it out of the process list and the shell history:

```bash
printf '%s\n' "$PDF_PASSWORD" | npx -y pdf-unlock statement.pdf
```

Always feed a password. Given none, the CLI prints `Password:`, reads EOF and exits 0 having touched nothing - a no-op that looks like success.

Then read the decrypted file at its original path. Reading it before this step fails with `The PDF specified is password protected`.

A whole folder unlocks in one run:

```bash
printf '%s\n' "$PDF_PASSWORD" | npx -y pdf-unlock ./statements -r
```

`-r` descends into subfolders; without it only top-level `.pdf` files are taken. `--dry-run` lists the targets and changes nothing. `npx pdf-unlock --help` carries the remaining flags.

## Result

Exit 0 means every file decrypted; exit 1 means at least one failed, after the batch ran to the end. One line per file says which:

- `✔ OK <path>` - decrypted in place, ready to read
- `✖ WRONG PW <path>` - password mismatch, source left encrypted. Ask the user for that file's password; statements from different banks or periods often carry different ones
- `✖ ERROR <path>` - qpdf failed (corrupt file, not a PDF); the message follows, indented

## Keeping the original in place

The decrypted file replaces the original, and the encrypted original lands in `<dir>/backup/<name>`. When the file must stay encrypted where it is - a synced folder, a shared drive, a fixture - copy it out first and unlock the copy:

```bash
cp statement.pdf /tmp/work/ && printf '%s\n' "$PDF_PASSWORD" | npx -y pdf-unlock /tmp/work/statement.pdf
```

Re-running over the same folder is safe: `backup/` is never rescanned, and an existing backup is never overwritten by an already-decrypted file.
