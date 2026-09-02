const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const { collectPdfFiles, isPdf } = require('../src/index');
const { makeTmpDir } = require('./helpers');

function touch(dir, relPath) {
  const full = path.join(dir, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, 'not a real pdf');
  return full;
}

function relSorted(dir, files) {
  return files.map((f) => path.relative(dir, f)).sort();
}

test('isPdf matches the .pdf extension regardless of case', () => {
  assert.equal(isPdf('a.pdf'), true);
  assert.equal(isPdf('a.PDF'), true);
  assert.equal(isPdf('a.Pdf'), true);
  assert.equal(isPdf('a.pdf.txt'), false);
  assert.equal(isPdf('pdf'), false);
  assert.equal(isPdf('a.txt'), false);
});

test('returns the file itself when the target is a pdf file', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = touch(dir, 'one.pdf');

  assert.deepEqual(collectPdfFiles(file), [file]);
});

test('returns nothing when the target is a file that is not a pdf', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = touch(dir, 'notes.txt');

  assert.deepEqual(collectPdfFiles(file), []);
});

test('collects only top-level pdfs when not recursive', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  touch(dir, 'a.pdf');
  touch(dir, 'b.PDF');
  touch(dir, 'notes.txt');
  touch(dir, 'nested/c.pdf');

  assert.deepEqual(relSorted(dir, collectPdfFiles(dir)), ['a.pdf', 'b.PDF']);
});

test('collects pdfs at every level when recursive', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  touch(dir, 'a.pdf');
  touch(dir, 'nested/b.pdf');
  touch(dir, 'nested/deeper/c.pdf');

  assert.deepEqual(relSorted(dir, collectPdfFiles(dir, { recursive: true })), [
    'a.pdf',
    path.join('nested', 'b.pdf'),
    path.join('nested', 'deeper', 'c.pdf'),
  ]);
});

test('never descends into the backup directory', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  touch(dir, 'a.pdf');
  touch(dir, 'backup/a.pdf');
  touch(dir, 'nested/backup/b.pdf');

  assert.deepEqual(relSorted(dir, collectPdfFiles(dir, { recursive: true })), ['a.pdf']);
});

test('skips the directory named by backupDirName instead of "backup"', (t) => {
  const dir = makeTmpDir();
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  touch(dir, 'a.pdf');
  touch(dir, 'backup/b.pdf');
  touch(dir, 'originals/c.pdf');

  const found = collectPdfFiles(dir, { recursive: true, backupDirName: 'originals' });
  assert.deepEqual(relSorted(dir, found), ['a.pdf', path.join('backup', 'b.pdf')]);
});

test('throws when the target does not exist', () => {
  assert.throws(() => collectPdfFiles('/definitely/not/here.pdf'), { code: 'ENOENT' });
});
