#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const distDir = path.join(rootDir, 'dist-release');
const buildDir = path.join(rootDir, 'build');
const iconPng = path.join(rootDir, 'src', 'assets', 'icon.png');
const iconIco = path.join(buildDir, 'icon.ico');

function tryKill(processName) {
  if (process.platform !== 'win32') return;
  try {
    execSync(`taskkill /IM ${processName} /F /T`, { stdio: 'ignore' });
    console.log(`Stopped ${processName}`);
  } catch {
    // Process was not running.
  }
}

async function generateWindowsIcon() {
  if (!fs.existsSync(iconPng)) {
    throw new Error(`Missing icon source: ${iconPng}`);
  }

  fs.mkdirSync(buildDir, { recursive: true });

  const sharp = require('sharp');
  const pngToIco = (await import('png-to-ico')).default;
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const pngBuffers = await Promise.all(
    sizes.map((size) =>
      sharp(iconPng)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toBuffer()
    )
  );

  const buf = await pngToIco(pngBuffers);
  fs.writeFileSync(iconIco, buf);
  console.log('Generated build/icon.ico');
}

async function main() {
  console.log('Preparing Windows build...');
  tryKill('GetGRC.exe');
  tryKill('shyldone.exe');
  await generateWindowsIcon();

  if (fs.existsSync(distDir)) {
    try {
      fs.rmSync(distDir, { recursive: true, force: true });
      console.log('Removed dist-release folder');
    } catch (error) {
      console.error(`
Could not delete dist-release. Close GetGRC and any File Explorer
windows open in that folder, then run the build again.

Path: ${distDir}
Reason: ${error.message}
`);
      process.exit(1);
    }
  }

  console.log('Ready to build.');
}

main().catch((error) => {
  console.error(`Prebuild failed: ${error.message}`);
  process.exit(1);
});
