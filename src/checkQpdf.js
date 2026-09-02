const { execFileSync } = require('child_process');

function checkQpdf() {
  try {
    const out = execFileSync('qpdf', ['--version'], { encoding: 'utf8' });
    return { installed: true, version: out.trim().split('\n')[0] };
  } catch (err) {
    return { installed: false, error: err };
  }
}

function printInstallInstructions() {
  const platform = process.platform;
  console.error('\n✖ qpdf is not installed on this machine (or was not found in PATH)\n');
  console.error('How to install qpdf:');
  if (platform === 'darwin') {
    console.error('  macOS (Homebrew):  brew install qpdf');
  } else if (platform === 'linux') {
    console.error('  Debian/Ubuntu:     sudo apt-get install qpdf');
    console.error('  Fedora:            sudo dnf install qpdf');
    console.error('  Arch:              sudo pacman -S qpdf');
  } else if (platform === 'win32') {
    console.error('  Windows (choco):   choco install qpdf');
    console.error('  Windows (scoop):   scoop install qpdf');
    console.error('  or download it from: https://github.com/qpdf/qpdf/releases');
  } else {
    console.error('  see the install instructions at: https://github.com/qpdf/qpdf');
  }
  console.error('\nRun this command again after the installation is complete.\n');
}

module.exports = { checkQpdf, printInstallInstructions };
