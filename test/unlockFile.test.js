const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { unlockFile } = require('../src/index');
const { PASSWORD, requireQpdf, makeTmpDir, writeEncryptedPdf, isEncrypted } = require('./helpers');

requireQpdf();

function tmpDir(t) {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function leftoverTempFiles(dir) {
  return fs.readdirSync(dir).filter((n) => n.startsWith('.pdf-unlock-tmp-'));
}

test('removes the encryption from the file in place', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const result = await unlockFile(file, PASSWORD);

  assert.equal(result.status, 'ok');
  assert.equal(isEncrypted(file), false);
});

test('backs the original up before overwriting it', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));
  const original = fs.readFileSync(file);

  await unlockFile(file, PASSWORD);

  const backup = path.join(dir, 'backup', 'a.pdf');
  assert.ok(fs.existsSync(backup), 'expected a backup copy');
  assert.deepEqual(fs.readFileSync(backup), original);
  assert.equal(isEncrypted(backup), true, 'the backup must still be the encrypted original');
});

test('keeps the first backup when the same file is unlocked twice', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));
  const backup = path.join(dir, 'backup', 'a.pdf');

  await unlockFile(file, PASSWORD);
  const afterFirst = fs.readFileSync(backup);
  await unlockFile(file, PASSWORD);

  assert.deepEqual(fs.readFileSync(backup), afterFirst);
  assert.equal(isEncrypted(backup), true, 'a re-run must not overwrite the backup with a decrypted file');
});

test('writes the backup into the directory named by backupDirName', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  await unlockFile(file, PASSWORD, { backupDirName: 'originals' });

  assert.ok(fs.existsSync(path.join(dir, 'originals', 'a.pdf')));
  assert.equal(fs.existsSync(path.join(dir, 'backup')), false);
});

test('creates no backup directory when backup is off', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  const result = await unlockFile(file, PASSWORD, { backup: false });

  assert.equal(result.status, 'ok');
  assert.equal(fs.existsSync(path.join(dir, 'backup')), false);
});

test('reports invalid-password and leaves the original untouched', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));
  const original = fs.readFileSync(file);

  const result = await unlockFile(file, 'wrong-password');

  assert.equal(result.status, 'invalid-password');
  assert.deepEqual(fs.readFileSync(file), original);
  assert.equal(isEncrypted(file), true);
});

test('leaves no temp file behind after a failed unlock', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  await unlockFile(file, 'wrong-password');

  assert.deepEqual(leftoverTempFiles(dir), []);
});

test('leaves no temp file behind after a successful unlock', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));

  await unlockFile(file, PASSWORD);

  assert.deepEqual(leftoverTempFiles(dir), []);
});

test('reports error rather than invalid-password when the file is not a pdf', async (t) => {
  const dir = tmpDir(t);
  const file = path.join(dir, 'broken.pdf');
  fs.writeFileSync(file, 'this is not a pdf at all');

  const result = await unlockFile(file, PASSWORD);

  assert.equal(result.status, 'error');
  assert.match(result.message, /\S/);
});

test('dry-run touches nothing', async (t) => {
  const dir = tmpDir(t);
  const file = writeEncryptedPdf(path.join(dir, 'a.pdf'));
  const original = fs.readFileSync(file);

  const result = await unlockFile(file, PASSWORD, { dryRun: true });

  assert.equal(result.status, 'dry-run');
  assert.deepEqual(fs.readFileSync(file), original);
  assert.equal(fs.existsSync(path.join(dir, 'backup')), false);
});
