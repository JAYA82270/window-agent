const { nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

function getIcon(name = 'icon.png') {
  const candidates = [path.join(__dirname, '..', 'assets', name), path.join(process.resourcesPath, 'src', 'assets', name)];
  const file = candidates.find(fs.existsSync);
  if (file) return nativeImage.createFromPath(file);
  return nativeImage.createFromDataURL('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiI+PHJlY3Qgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2IiByeD0iNCIgZmlsbD0iIzEzYjhhNiIvPjwvc3ZnPg==');
}
module.exports = { getIcon };
