const fs = require('fs');
let content = fs.readFileSync('src/app/stock/page.tsx', 'utf8');

// Fix the literal '\n' issue
content = content.replace(/\\n/g, '\n');

fs.writeFileSync('src/app/stock/page.tsx', content);
