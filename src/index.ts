#!/usr/bin/env node

import * as path from 'path';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { DEFAULT_PORT } from './constants.js';
import { loadAllAssets, addClient, startServer, stopServer } from './server.js';

const port = parseInt(process.env['PORT'] || String(DEFAULT_PORT), 10);
const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

// Determine dist root (import.meta.dirname = dist/server/, so parent = dist/)
const distDir = path.resolve(import.meta.dirname, '..');
const assetsRoot = distDir; // dist/ contains assets/ subfolder (copied by build:assets)

// Serve static webview files
const webviewDir = path.join(distDir, 'webview');
app.use(express.static(webviewDir));

// Serve assets (sprites, PNGs, catalog)
const assetsDir = path.join(distDir, 'assets');
app.use('/assets', express.static(assetsDir));

// WebSocket connections
wss.on('connection', (ws) => {
	console.log(`[Server] Client connected (${wss.clients.size} total)`);
	addClient(ws, assetsRoot);
});

// Start
async function main(): Promise<void> {
	// Load assets before accepting connections
	await loadAllAssets(assetsRoot);

	httpServer.listen(port, () => {
		console.log(`[Pixel Agents] Server running at http://localhost:${port}`);
		startServer();
	});

	// Graceful shutdown
	const shutdown = (): void => {
		console.log('\n[Server] Shutting down...');
		stopServer();
		httpServer.close();
		process.exit(0);
	};
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

main().catch((err) => {
	console.error('[Server] Fatal error:', err);
	process.exit(1);
});
