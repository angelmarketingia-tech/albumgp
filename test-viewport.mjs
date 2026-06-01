// Simple test to verify viewport in Next.js 14.2.18
// This script just checks what Next.js exports

const { createDefaultViewport } = require('./node_modules/next/dist/lib/metadata/default-metadata.js');

const viewport = createDefaultViewport();
console.log('Default viewport from Next.js 14.2.18:');
console.log(JSON.stringify(viewport, null, 2));
