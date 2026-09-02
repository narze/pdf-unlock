const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const { PASSWORD, requireQpdf, makeTmpDir, writeEncryptedPdf, isEncrypted } = require('./helpers');

requireQpdf();

const CLI = path.join(__dirname, '..', 'bin', 'pdf-unlock.js');

/** Run the CLI and collect its exit code and output. `stdin` is written then closed. */
function runCli(args, { cwd, stdin } = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { cwd, stdio: 'pipe' });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    if (stdin !== undefined) child.stdin.write(stdin);
    child.stdin.end();
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

function tmpDir(t) {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test('--help prints usage and exits 0', async () => {
  const { code, stdout } = await runCli(['--help']);

  assert.equal(code, 0);
  assert.match(stdout, /Usage:/);
  assert.match(stdout, /--recursive/);
});

test('no arguments prints usage and exits 1', async () => {
  const { code, stdout } = await runCli([]);

  assert.equal(code, 1);
  assert.match(stdout, /Usage:/);
});

test('exits 1 when the target does not exist', async () => {
  const { code, stderr } = await runCli(['/definitely/not/here.pdf', '-p', PASSWORD]);

  assert.equal(code, 1);
  assert.match(stderr, /ไม่พบไฟล์หรือโฟลเดอร์/);
});

test('exits 0 with a notice when the folder holds no pdf', async (t) => {
  const dir = tmpDir(t);
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'hello');

  const { code, stdout } = await runCli([dir, '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.match(stdout, /ไม่พบไฟล์ \.pdf/);
});

test('--dry-run lists the files and changes nothing', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));
  const before = fs.readFileSync(file);

  const { code, stdout } = await runCli([dir, '-p', PASSWORD, '--dry-run']);

  assert.equal(code, 0);
  assert.match(stdout, /a\.pdf/);
  assert.match(stdout, /dry-run/);
  assert.deepEqual(fs.readFileSync(file), before);
  assert.equal(fs.existsSync(path.join(dir, 'backup')), false);
});

test('unlocks a single file given on the command line', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const { code, stdout } = await runCli([file, '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.match(stdout, /OK/);
  assert.equal(isEncrypted(file), false);
  assert.equal(isEncrypted(path.join(dir, 'backup', 'a.pdf')), true);
});

test('without -r it leaves pdfs in subfolders alone', async (t) => {
  const dir = tmpDir(t);
  const top = writeEncryptedPdf(path.join(dir, 'top.pdf'));
  const nested = writeEncryptedPdf(path.join(dir, 'nested', 'deep.pdf'));

  const { code } = await runCli([dir, '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.equal(isEncrypted(top), false);
  assert.equal(isEncrypted(nested), true);
  assert.equal(fs.existsSync(path.join(dir, 'nested', 'backup')), false);
});

test('with -r it unlocks every level and backs each level up separately', async (t) => {
  const dir = tmpDir(t);
  const top = writeEncryptedPdf(path.join(dir, 'top.pdf'));
  const nested = writeEncryptedPdf(path.join(dir, 'nested', 'deep.pdf'));

  const { code } = await runCli([dir, '-r', '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.equal(isEncrypted(top), false);
  assert.equal(isEncrypted(nested), false);
  assert.equal(isEncrypted(path.join(dir, 'backup', 'top.pdf')), true);
  assert.equal(isEncrypted(path.join(dir, 'nested', 'backup', 'deep.pdf')), true);
});

test('a re-run with -r does not process the backups it made', async (t) => {
  const dir = tmpDir(t);
  writeEncryptedPdf(path.join(dir, 'a.pdf'));

  await runCli([dir, '-r', '-p', PASSWORD]);
  const backup = path.join(dir, 'backup', 'a.pdf');
  const afterFirst = fs.readFileSync(backup);
  const { code, stdout } = await runCli([dir, '-r', '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.deepEqual(fs.readFileSync(backup), afterFirst);
  assert.ok(!stdout.includes(path.join('backup', 'a.pdf')), 'backups must never be listed');
});

test('a wrong password fails that file without stopping the batch', async (t) => {
  const dir = tmpDir(t);
  const good = writeEncryptedPdf(path.join(dir, 'good.pdf'), 'other-password');
  const alsoGood = writeEncryptedPdf(path.join(dir, 'zz-right.pdf'), PASSWORD);

  const { code, stdout } = await runCli([dir, '-p', PASSWORD]);

  assert.equal(code, 1);
  assert.match(stdout, /WRONG PW/);
  assert.match(stdout, /OK/);
  assert.equal(isEncrypted(good), true, 'the mismatched file must stay encrypted');
  assert.equal(isEncrypted(alsoGood), false, 'later files must still be processed');
});

test('--no-backup unlocks without leaving a backup folder', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const { code, stdout } = await runCli([dir, '-p', PASSWORD, '--no-backup']);

  assert.equal(code, 0);
  assert.equal(isEncrypted(file), false);
  assert.equal(fs.existsSync(path.join(dir, 'backup')), false);
  assert.ok(!stdout.includes('backup'), 'the backup notice must be omitted');
});

test('--backup-dir puts the originals in the named folder', async (t) => {
  const dir = tmpDir(t);
  writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const { code } = await runCli([dir, '-p', PASSWORD, '--backup-dir', 'originals']);

  assert.equal(code, 0);
  assert.equal(isEncrypted(path.join(dir, 'originals', 'a.pdf')), true);
});

test('asks for the password on stdin when -p is not given', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const { code, stdout } = await runCli([dir], { stdin: PASSWORD + '\n' });

  assert.equal(code, 0);
  assert.match(stdout, /Password:/);
  assert.equal(isEncrypted(file), false);
  assert.ok(!stdout.includes(PASSWORD), 'the typed password must not be echoed');
});

test('exits 1 when an empty password is entered at the prompt', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const { code, stderr } = await runCli([dir], { stdin: '\n' });

  assert.equal(code, 1);
  assert.match(stderr, /ต้องระบุ password/);
  assert.equal(isEncrypted(file), true);
});

test('handles a password holding shell metacharacters', async (t) => {
  const dir = tmpDir(t);
  const tricky = 'a b$(touch pwned);"\'&|`';
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'), tricky);

  const { code } = await runCli([dir, '-p', tricky]);

  assert.equal(code, 0);
  assert.equal(isEncrypted(file), false);
  assert.equal(fs.existsSync(path.join(dir, 'pwned')), false, 'no shell must be involved');
  assert.equal(fs.existsSync(path.join(process.cwd(), 'pwned')), false);
});

test('handles paths with spaces and Thai characters', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'โฟลเดอร์ ย่อย', 'ใบแจ้งยอด มีนาคม.pdf'));

  const { code } = await runCli([dir, '-r', '-p', PASSWORD]);

  assert.equal(code, 0);
  assert.equal(isEncrypted(file), false);
  assert.equal(isEncrypted(path.join(dir, 'โฟลเดอร์ ย่อย', 'backup', 'ใบแจ้งยอด มีนาคม.pdf')), true);
});
