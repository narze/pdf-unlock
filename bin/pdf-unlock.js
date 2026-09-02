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
pdf-unlock - เอา password protection ออกจากไฟล์ PDF (ต้องรู้ password ที่ถูกต้อง)

Usage:
  npx pdf-unlock <file-or-folder> [options]

Options:
  -p, --password <pw>   password ของไฟล์ (ถ้าไม่ระบุจะถาม interactive)
  -r, --recursive        ถ้า target เป็นโฟลเดอร์ ให้ค้นหาไฟล์ .pdf ในโฟลเดอร์ย่อยด้วย
      --backup-dir <name>  ชื่อโฟลเดอร์ backup (default: "backup")
      --no-backup        ไม่ต้อง backup ไฟล์ต้นฉบับ (ไม่แนะนำ)
      --dry-run          แสดงรายการไฟล์ที่จะประมวลผล โดยไม่แก้ไขจริง
  -h, --help             แสดงข้อความช่วยเหลือนี้

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
    console.error(`✖ ไม่พบไฟล์หรือโฟลเดอร์: ${target}`);
    console.error(err.message);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('ไม่พบไฟล์ .pdf ให้ประมวลผล');
    process.exit(0);
  }

  console.log(`พบไฟล์ PDF ${files.length} ไฟล์:`);
  files.forEach((f) => console.log('  - ' + path.relative(process.cwd(), f)));

  if (args.dryRun) {
    console.log('\n(dry-run: ไม่มีการแก้ไขไฟล์จริง)');
    process.exit(0);
  }

  let password = args.password;
  if (!password) {
    password = await promptPassword('\nPassword: ');
  }
  if (!password) {
    console.error('✖ ต้องระบุ password');
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

  console.log(`\nสำเร็จ ${okCount} ไฟล์, ล้มเหลว ${failCount} ไฟล์`);
  if (!args.noBackup) {
    console.log(`(ไฟล์ต้นฉบับถูก backup ไว้ในโฟลเดอร์ "${args.backupDir || 'backup'}" ข้างไฟล์เดิมแล้ว)`);
  }
  if (badPasswordSeen) {
    console.log('หมายเหตุ: มีบางไฟล์ password ไม่ตรง อาจเป็นเพราะไฟล์เหล่านั้นใช้ password คนละตัว');
  }

  process.exit(failCount > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('เกิดข้อผิดพลาดที่ไม่คาดคิด:', err);
  process.exit(1);
});
