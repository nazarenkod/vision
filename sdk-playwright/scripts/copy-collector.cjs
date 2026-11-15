// Puts web-tree/collect-tree.js into dist/ as it is: the package runs the very script the Java SDK
// runs, so the same page gives the same tree (spec 050, REQ-050-24). Never edit the copy.
const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, '..', '..', 'web-tree', 'collect-tree.js');
const target = path.join(__dirname, '..', 'dist', 'collect-tree.js');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
