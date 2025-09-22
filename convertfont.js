const fs = require('fs');
const path = require('path');

const fontFiles = [
  'texgyrebonum-regular.otf',
  'texgyrebonum-bold.otf',
  'texgyrebonum-italic.otf',
  'texgyrebonum-bolditalic.otf'
];

fontFiles.forEach(file => {
  const fontPath = path.join(__dirname, file);
  try {
    const fontData = fs.readFileSync(fontPath);
    console.log(`${file} loaded successfully, size: ${fontData.length} bytes`);
  } catch (err) {
    console.error(`Could not find ${file} at path: ${fontPath}`);
  }
});
