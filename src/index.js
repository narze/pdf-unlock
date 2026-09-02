const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

function isPdf(filename) {
  return /\.pdf$/i.test(filename);
}

/**
 * Collect PDF files to process starting from `targetPath`.
 * - If targetPath is a file, returns [targetPath] (if it's a .pdf).
 * - If targetPath is a directory, returns pdf files inside it.
 *   Recurses into subdirectories when `recursive` is true.
 *   Directories named `backupDirName` are always skipped (never touch backups).
 */
function collectPdfFiles(targetPath, { recursive = false, backupDirName = 'backup' } = {}) {
  const stat = fs.statSync(targetPath);
  if (stat.isFile()) {
    return isPdf(targetPath) ? [targetPath] : [];
  }

  const results = [];
  const entries = fs.readdirSync(targetPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === backupDirName) continue; // never descend into backups
      if (recursive) {
        results.push(...collectPdfFiles(fullPath, { recursive, backupDirName }));
      }
    } else if (entry.isFile() && isPdf(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

function runQpdfDecrypt(inputPath, outputPath, password) {
  return new Promise((resolve) => {
    execFile(
      'qpdf',
      ['--password=' + password, '--decrypt', inputPath, outputPath],
      { maxBuffer: 1024 * 1024 * 32 },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ ok: true });
          return;
        }
        const message = (stderr || error.message || '').toString();
        const invalidPassword = /invalid password/i.test(message);
        resolve({ ok: false, invalidPassword, message: message.trim() });
      }
    );
  });
}

/**
 * Unlock (remove password protection from) a single PDF file.
 * Backs up the original into `<dir>/<backupDirName>/<basename>` first
 * (unless a backup already exists there, or `backup` is false).
 */
async function unlockFile(filePath, password, options = {}) {
  const {
    backup = true,
    backupDirName = 'backup',
    dryRun = false,
  } = options;

  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  const result = { file: filePath, status: null, message: null };

  if (dryRun) {
    result.status = 'dry-run';
    return result;
  }

  if (backup) {
    const backupDir = path.join(dir, backupDirName);
    fs.mkdirSync(backupDir, { recursive: true });
    const backupPath = path.join(backupDir, base);
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(filePath, backupPath);
    }
  }

  const tmpPath = path.join(dir, `.pdf-unlock-tmp-${process.pid}-${base}`);
  const outcome = await runQpdfDecrypt(filePath, tmpPath, password);

  if (outcome.ok) {
    fs.renameSync(tmpPath, filePath);
    result.status = 'ok';
  } else {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    result.status = outcome.invalidPassword ? 'invalid-password' : 'error';
    result.message = outcome.message;
  }

  return result;
}

module.exports = { isPdf, collectPdfFiles, unlockFile, runQpdfDecrypt };
