const fs = require('fs');
const path = require('path');
const dir = 'packages/shared-types/src';

fs.readdirSync(dir).forEach(file => {
  if (file.endsWith('.ts')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/from '(\.[^']+)'/g, "from '$1.js'");
    content = content.replace(/from "(\.[^"]+)"/g, 'from "$1.js"');
    content = content.replace(/export \* from '(\.[^']+)'/g, "export * from '$1.js'");
    content = content.replace(/export \* from "(\.[^"]+)"/g, 'export * from "$1.js"');
    fs.writeFileSync(filePath, content);
  }
});
