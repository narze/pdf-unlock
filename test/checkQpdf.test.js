const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { execFileSync } = require('child_process');

const { checkQpdf } = require('../src/checkQpdf');
const { requireQpdf } = require('./helpers');

requireQpdf();

const SRC = path.join(__dirname, '..', 'src', 'checkQpdf');

test('reports the installed qpdf and its version', () => {
  const status = checkQpdf();

  assert.equal(status.installed, true);
  assert.match(status.version, /qpdf version/i);
});

test('reports qpdf missing when it is not on the PATH', () => {
  const out = execFileSync(
    process.execPath,
    ['-e', `console.log(JSON.stringify(require(${JSON.stringify(SRC)}).checkQpdf().installed))`],
    { env: { PATH: '/nonexistent' }, encoding: 'utf8' }
  );

  assert.equal(out.trim(), 'false');
});

test('the install instructions name a command for this platform', () => {
  // printInstallInstructions writes to stderr; run it in a child to capture that cleanly.
  const child = require('child_process').spawnSync(
    process.execPath,
    ['-e', `require(${JSON.stringify(SRC)}).printInstallInstructions()`],
    { encoding: 'utf8' }
  );

  const expected = {
    darwin: /brew install qpdf/,
    linux: /apt-get install qpdf/,
    win32: /choco install qpdf/,
  }[process.platform] || /github\.com\/qpdf\/qpdf/;

  assert.equal(child.status, 0);
  assert.match(child.stderr, expected);
  assert.match(child.stderr, /qpdf/);
});
