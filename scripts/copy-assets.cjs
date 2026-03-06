const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'webview-ui', 'public', 'assets');
const dstDir = path.join(__dirname, '..', 'dist', 'assets');

if (fs.existsSync(srcDir)) {
	if (fs.existsSync(dstDir)) {
		fs.rmSync(dstDir, { recursive: true });
	}
	fs.cpSync(srcDir, dstDir, { recursive: true });
	console.log('Copied assets/ -> dist/assets/');
} else {
	console.log('No assets/ folder found (optional)');
}
