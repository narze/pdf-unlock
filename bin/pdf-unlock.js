#!/usr/bin/env node

const path = require('path');
const { checkQpdf, printInstallInstructions } = require('../src/checkQpdf');
const { promptPassword } = require('../src/promptPassword');
const { collectPdfFiles, unlockFile } = require('../src/index');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-p' || a === '--password') {
      args.password = argv[++i];
    } else if (a === '-r' || a === '--recursive') {
      args.recursive = true;
    } else if (a === '--no-backup') {
      args.noBackup = true;
    } else if (a === '--backup-dir') {
      args.backupDir = argv[++i];
    } else if (a === '--dry-run') {
      args.dryRun = true;
    } else if (a === '-h' || a === '--help') {
      args.help = true;
    } else {
      args._.push(a);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
pdf-unlock - remove password protection from PDF files (you must know the correct password)

Usage:
  npx pdf-unlock <file-or-folder> [options]

Options:
  -p, --password <pw>   password of the files (asks interactively if not given)
  -r, --recursive        if the target is a folder, also search .pdf files in subfolders
      --backup-dir <name>  name of the backup folder (default: "backup")
      --no-backup        do not back up the original files (not recommended)
      --dry-run          list the files that would be processed, without changing them
  -h, --help             show this help message

Examples:
  npx pdf-unlock statement.pdf -p mypassword
  npx pdf-unlock ./statements -r
  npx pdf-unlock ./statements -r --dry-run
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || args._.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const target = path.resolve(args._[0]);

  const qpdfStatus = checkQpdf();
  if (!qpdfStatus.installed) {
    printInstallInstructions();
    process.exit(1);
  }

  let files;
  try {
    files = collectPdfFiles(target, {
      recursive: !!args.recursive,
      backupDirName: args.backupDir || 'backup',
    });
  } catch (err) {
    console.error(`✖ File or folder not found: ${target}`);
    console.error(err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('No .pdf files to process');
    process.exit(0);
  }

  console.log(`Found ${files.length} PDF file(s):`);
  files.forEach((f) => console.log('  - ' + path.relative(process.cwd(), f)));

  if (args.dryRun) {
    console.log('\n(dry-run: no files were changed)');
    process.exit(0);
  }

  let password = args.password;
  if (!password) {
    password = await promptPassword('\nPassword: ');
  }
  if (!password) {
    console.error('✖ A password is required');
    process.exit(1);
  }

  console.log('');
  let okCount = 0;
  let failCount = 0;
  let badPasswordSeen = false;

  for (const file of files) {
    const rel = path.relative(process.cwd(), file);
    const result = await unlockFile(file, password, {
      backup: !args.noBackup,
      backupDirName: args.backupDir || 'backup',
    });

    if (result.status === 'ok') {
      console.log(`✔ OK      ${rel}`);
      okCount++;
    } else if (result.status === 'invalid-password') {
      console.log(`✖ WRONG PW ${rel}`);
      failCount++;
      badPasswordSeen = true;
    } else {
      console.log(`✖ ERROR   ${rel}`);
      if (result.message) console.log('    ' + result.message.split('\n').join('\n    '));
      failCount++;
    }
  }

  console.log(`\nDone: ${okCount} file(s) succeeded, ${failCount} file(s) failed`);
  if (!args.noBackup) {
    console.log(`(the originals were backed up in the "${args.backupDir || 'backup'}" folder next to each file)`);
  }
  if (badPasswordSeen) {
    console.log('Note: the password did not match some files. They may use a different password.');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
