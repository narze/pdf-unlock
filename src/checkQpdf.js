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
  console.error('\n✖ qpdf ไม่ได้ติดตั้งอยู่ในเครื่อง (หรือหาไม่เจอใน PATH)\n');
  console.error('วิธีติดตั้ง qpdf:');
  if (platform === 'darwin') {
    console.error('  macOS (Homebrew):  brew install qpdf');
  } else if (platform === 'linux') {
    console.error('  Debian/Ubuntu:     sudo apt-get install qpdf');
    console.error('  Fedora:            sudo dnf install qpdf');
    console.error('  Arch:              sudo pacman -S qpdf');
  } else if (platform === 'win32') {
    console.error('  Windows (choco):   choco install qpdf');
    console.error('  Windows (scoop):   scoop install qpdf');
    console.error('  หรือดาวน์โหลดจาก: https://github.com/qpdf/qpdf/releases');
  } else {
    console.error('  ดูวิธีติดตั้งได้ที่: https://github.com/qpdf/qpdf');
  }
  console.error('\nติดตั้งเสร็จแล้วลองรันคำสั่งนี้ใหม่อีกครั้ง\n');
}

module.exports = { checkQpdf, printInstallInstructions };
