const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function createZipFromDir(dirPath, zipFilePath) {
  const zip = new JSZip();
  const files = fs.readdirSync(dirPath);
  for (const f of files) {
    const fullPath = path.join(dirPath, f);
    if (fs.statSync(fullPath).isFile()) {
      zip.file(f, fs.readFileSync(fullPath));
    }
  }
  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 }
  });
  fs.writeFileSync(zipFilePath, buffer);
  console.log(`[ZIP SUCCESS] Created: ${zipFilePath} (${buffer.length} bytes)`);

  // Try copying to user's Downloads folder if running locally
  const homeDir = process.env.USERPROFILE || process.env.HOME;
  if (homeDir) {
    const downloadsDir = path.join(homeDir, 'Downloads');
    if (fs.existsSync(downloadsDir)) {
      const destPath = path.join(downloadsDir, path.basename(zipFilePath));
      fs.copyFileSync(zipFilePath, destPath);
      console.log(`[DOWNLOADS] Copied to: ${destPath}`);
    }
  }
}

async function run() {
  console.log('Building PushBox Beta ZIP packages...');
  
  // 1. Beta 4.92
  const beta492Dir = path.join(__dirname, 'beta');
  const beta492Zip = path.join(__dirname, 'PushBox-v4.92-Beta.zip');
  if (fs.existsSync(beta492Dir)) {
    await createZipFromDir(beta492Dir, beta492Zip);
  }

  // 2. Beta 4.65
  const beta465Dir = path.join(__dirname, 'beta-4.65');
  const beta465Zip = path.join(__dirname, 'PushBox-v4.65-Beta.zip');
  if (fs.existsSync(beta465Dir)) {
    await createZipFromDir(beta465Dir, beta465Zip);
  }

  console.log('All Beta ZIP files created successfully!');
}

run().catch(err => {
  console.error('Error creating ZIP files:', err);
  process.exit(1);
});
