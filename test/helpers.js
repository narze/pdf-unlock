const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PASSWORD = 'testpw';

// Smallest PDF qpdf will accept after normalisation.
const MINIMAL_PDF = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj',
  'trailer<</Root 1 0 R/Size 4>>',
  '',
].join('\n');

function requireQpdf() {
  try {
    execFileSync('qpdf', ['--version'], { stdio: 'pipe' });
  } catch {
    throw new Error('qpdf is required to run these tests. Install it: brew install qpdf');
  }
}

function makeTmpDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-unlock-test-'));
  return dir;
}

/** Write a valid, unencrypted PDF at `filePath`. */
function writePlainPdf(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const raw = filePath + '.raw';
  fs.writeFileSync(raw, MINIMAL_PDF);
  execFileSync('qpdf', ['--warning-exit-0', raw, filePath], { stdio: 'pipe' });
  fs.unlinkSync(raw);
  return filePath;
}

/** Write a PDF at `filePath` encrypted with `password`. */
function writeEncryptedPdf(filePath, password = PASSWORD) {
  const plain = filePath + '.plain';
  writePlainPdf(plain);
  execFileSync('qpdf', ['--encrypt', password, password, '256', '--', plain, filePath], {
    stdio: 'pipe',
  });
  fs.unlinkSync(plain);
  return filePath;
}

/** True when qpdf reports the file still carries encryption. */
function isEncrypted(filePath) {
  const out = execFileSync('qpdf', ['--show-encryption', filePath], {
    encoding: 'utf8',
    stdio: 'pipe',
  });
  return !/File is not encrypted/.test(out);
}

module.exports = {
  PASSWORD,
  requireQpdf,
  makeTmpDir,
  writePlainPdf,
  writeEncryptedPdf,
  isEncrypted,
};
