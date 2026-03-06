import * as fs from 'fs';
import type { WebSocket } from 'ws';
import type { AgentState } from './types.js';
import { PROJECT_DISCOVERY_INTERVAL_MS, SESSION_STALENESS_MS } from './constants.js';
import { startFileWatching, stopFileWatching } from './fileWatcher.js';
import { scanAllProjects } from './projectScanner.js';
import {
	loadFurnitureAssets,
	loadWallTiles,
	loadFloorTiles,
	loadCharacterSprites,
	loadDefaultLayout,
	spritesToObject,
} from './assetLoader.js';
import type { LoadedWallTiles, LoadedFloorTiles, LoadedCharacterSprites } from './assetLoader.js';
import { loadLayout, writeLayoutToFile, watchLayoutFile } from './layoutPersistence.js';
import type { LayoutWatcher } from './layoutPersistence.js';
import { readState, updateAgentSeats, updateSoundEnabled, updateMusicSettings, updatePetEnabled } from './statePersistence.js';

// ── Shared state ─────────────────────────────────────────────

const clients = new Set<WebSocket>();
const agents = new Map<number, AgentState>();
const fileWatchers = new Map<number, fs.FSWatcher>();
const pollingTimers = new Map<number, ReturnType<typeof setInterval>>();
const waitingTimers = new Map<number, ReturnType<typeof setTimeout>>();
const permissionTimers = new Map<number, ReturnType<typeof setTimeout>>();
const trackedFiles = new Set<string>(); // JSONL files currently being watched

let nextAgentId = 1;
let discoveryTimer: ReturnType<typeof setInterval> | null = null;
let layoutWatcher: LayoutWatcher | null = null;

// Cached assets (loaded once at startup)
let cachedFurnitureObj: { catalog: unknown[]; sprites: Record<string, string[][]> } | null = null;
let cachedWalls: LoadedWallTiles | null = null;
let cachedFloors: LoadedFloorTiles | null = null;
let cachedCharacters: LoadedCharacterSprites | null = null;

// ── Broadcast ────────────────────────────────────────────────

export function broadcast(msg: unknown): void {
	const data = JSON.stringify(msg);
	for (const ws of clients) {
		if (ws.readyState === 1) { // WebSocket.OPEN
			ws.send(data);
		}
	}
}

function sendTo(ws: WebSocket, msg: unknown): void {
	if (ws.readyState === 1) {
		ws.send(JSON.stringify(msg));
	}
}

// ── Asset loading (once at startup) ──────────────────────────

export async function loadAllAssets(assetsRoot: string): Promise<void> {
	console.log('[Server] Loading assets from:', assetsRoot);

	const [furniture, walls, floors, characters] = await Promise.all([
		loadFurnitureAssets(assetsRoot),
		loadWallTiles(assetsRoot),
		loadFloorTiles(assetsRoot),
		loadCharacterSprites(assetsRoot),
	]);

	if (furniture) {
		cachedFurnitureObj = {
			catalog: furniture.catalog,
			sprites: spritesToObject(furniture),
		};
	}
	cachedWalls = walls;
	cachedFloors = floors;
	cachedCharacters = characters;

	console.log('[Server] Assets loaded:',
		`furniture=${!!furniture}`,
		`walls=${!!walls}`,
		`floors=${!!floors}`,
		`characters=${!!characters}`,
	);
}

// ── Client init sequence ─────────────────────────────────────

function sendInitSequence(ws: WebSocket, assetsRoot: string): void {
	// 1. Character sprites
	if (cachedCharacters) {
		sendTo(ws, { type: 'characterSpritesLoaded', characters: cachedCharacters.characters });
	}

	// 2. Floor tiles
	if (cachedFloors) {
		sendTo(ws, { type: 'floorTilesLoaded', sprites: cachedFloors.sprites });
	}

	// 3. Wall tiles
	if (cachedWalls) {
		sendTo(ws, { type: 'wallTilesLoaded', sprites: cachedWalls.sprites });
	}

	// 4. Furniture assets
	if (cachedFurnitureObj) {
		sendTo(ws, {
			type: 'furnitureAssetsLoaded',
			catalog: cachedFurnitureObj.catalog,
			sprites: cachedFurnitureObj.sprites,
		});
	}

	// 5. Existing agents (must arrive BEFORE layoutLoaded so the webview
	//    can buffer them in pendingAgents; layoutLoaded handler flushes the buffer)
	const state = readState();
	const agentIds = Array.from(agents.keys()).sort((a, b) => a - b);
	sendTo(ws, {
		type: 'existingAgents',
		agents: agentIds,
		agentMeta: state.agentSeats,
		folderNames: {},
	});

	// 6. Layout (triggers agent character creation from the pending buffer)
	const defaultLayout = loadDefaultLayout(assetsRoot);
	const layout = loadLayout(defaultLayout);
	sendTo(ws, { type: 'layoutLoaded', layout });

	// Re-send current agent statuses
	for (const [agentId, agent] of agents) {
		for (const [toolId, status] of agent.activeToolStatuses) {
			sendTo(ws, { type: 'agentToolStart', id: agentId, toolId, status });
		}
		if (agent.isWaiting) {
			sendTo(ws, { type: 'agentStatus', id: agentId, status: 'waiting' });
		}
	}

	// 7. Transcript buffers for active agents
	for (const [agentId, agent] of agents) {
		if (agent.transcriptBuffer.length > 0) {
			sendTo(ws, { type: 'transcriptBuffer', agentId, entries: agent.transcriptBuffer });
		}
	}

	// 8. Settings
	sendTo(ws, {
		type: 'settingsLoaded',
		soundEnabled: state.soundEnabled,
		musicEnabled: state.musicEnabled,
		musicVolume: state.musicVolume,
		petEnabled: state.petEnabled,
	});
}

// ── Client message handling ──────────────────────────────────

function handleClientMessage(ws: WebSocket, msg: unknown, assetsRoot: string): void {
	const data = msg as Record<string, unknown>;
	switch (data.type) {
		case 'webviewReady':
			sendInitSequence(ws, assetsRoot);
			break;
		case 'saveLayout': {
			const layout = data.layout as Record<string, unknown>;
			if (layout) {
				writeLayoutToFile(layout);
				layoutWatcher?.markOwnWrite();
			}
			break;
		}
		case 'saveAgentSeats': {
			const seats = data.seats as Record<string, { palette?: number; hueShift?: number; seatId?: string | null }>;
			if (seats) {
				updateAgentSeats(seats);
			}
			break;
		}
		case 'setSoundEnabled': {
			const enabled = data.enabled as boolean;
			updateSoundEnabled(enabled);
			break;
		}
		case 'setMusicEnabled': {
			const enabled = data.enabled as boolean;
			const volume = data.volume as number;
			updateMusicSettings(enabled, volume);
			break;
		}
		case 'setPetEnabled': {
			const enabled = data.enabled as boolean;
			updatePetEnabled(enabled);
			break;
		}
	}
}

// ── Agent discovery ──────────────────────────────────────────

function createAgent(jsonlFile: string, projectDir: string, projectLabel: string): void {
	const id = nextAgentId++;
	const agent: AgentState = {
		id,
		projectDir,
		projectLabel,
		jsonlFile,
		fileOffset: 0,
		lineBuffer: '',
		activeToolIds: new Set(),
		activeToolStatuses: new Map(),
		activeToolNames: new Map(),
		activeSubagentToolIds: new Map(),
		activeSubagentToolNames: new Map(),
		isWaiting: false,
		permissionSent: false,
		hadToolsInTurn: false,
		lastActivityTime: Date.now(),
		transcriptBuffer: [],
		transcriptSeq: 0,
	};

	// Skip to end of file (don't replay history)
	try {
		const stat = fs.statSync(jsonlFile);
		agent.fileOffset = stat.size;
	} catch { /* file might not exist yet */ }

	agents.set(id, agent);
	trackedFiles.add(jsonlFile);

	console.log(`[Server] Agent ${id} created: ${projectLabel} (${jsonlFile})`);
	broadcast({ type: 'agentCreated', id });

	startFileWatching(id, jsonlFile, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers, broadcast);
}

function removeAgent(id: number): void {
	const agent = agents.get(id);
	if (!agent) return;

	stopFileWatching(id, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
	trackedFiles.delete(agent.jsonlFile);
	agents.delete(id);

	console.log(`[Server] Agent ${id} removed: ${agent.projectLabel}`);
	broadcast({ type: 'agentClosed', id });
}

function discoverAndSyncAgents(): void {
	const sessions = scanAllProjects();
	const activeFiles = new Set(sessions.map(s => s.jsonlFile));

	// New sessions → create agents
	for (const session of sessions) {
		if (!trackedFiles.has(session.jsonlFile)) {
			createAgent(session.jsonlFile, session.projectDir, session.projectLabel);
		}
	}

	// Stale agents → remove
	const now = Date.now();
	for (const [id, agent] of agents) {
		if (!activeFiles.has(agent.jsonlFile) && now - agent.lastActivityTime > SESSION_STALENESS_MS) {
			removeAgent(id);
		}
	}
}

// ── Layout watching ──────────────────────────────────────────

function startLayoutWatching(): void {
	layoutWatcher = watchLayoutFile((layout) => {
		broadcast({ type: 'layoutLoaded', layout });
	});
}

// ── Public API ───────────────────────────────────────────────

export function addClient(ws: WebSocket, assetsRoot: string): void {
	clients.add(ws);

	ws.on('message', (raw) => {
		try {
			const msg = JSON.parse(raw.toString());
			handleClientMessage(ws, msg, assetsRoot);
		} catch (err) {
			console.error('[Server] Failed to parse client message:', err);
		}
	});

	ws.on('close', () => {
		clients.delete(ws);
	});
}

export function startDiscovery(): void {
	// Run immediately, then periodically
	discoverAndSyncAgents();
	discoveryTimer = setInterval(discoverAndSyncAgents, PROJECT_DISCOVERY_INTERVAL_MS);
}

export function startServer(): void {
	startLayoutWatching();
	startDiscovery();
	console.log('[Server] Discovery and layout watching started');
}

export function stopServer(): void {
	if (discoveryTimer) {
		clearInterval(discoveryTimer);
		discoveryTimer = null;
	}
	layoutWatcher?.dispose();
	layoutWatcher = null;

	// Clean up all agents
	for (const id of [...agents.keys()]) {
		stopFileWatching(id, agents, fileWatchers, pollingTimers, waitingTimers, permissionTimers);
	}
	agents.clear();
	trackedFiles.clear();

	// Close all client connections
	for (const ws of clients) {
		ws.close();
	}
	clients.clear();
}
