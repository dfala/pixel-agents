import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, STATE_FILE_NAME } from './constants.js';

export interface AppState {
	soundEnabled: boolean;
	agentSeats: Record<string, { palette?: number; hueShift?: number; seatId?: string | null }>;
}

function getStateFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, STATE_FILE_NAME);
}

export function readState(): AppState {
	const filePath = getStateFilePath();
	try {
		if (!fs.existsSync(filePath)) return { soundEnabled: true, agentSeats: {} };
		const raw = fs.readFileSync(filePath, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<AppState>;
		return {
			soundEnabled: parsed.soundEnabled ?? true,
			agentSeats: parsed.agentSeats ?? {},
		};
	} catch {
		return { soundEnabled: true, agentSeats: {} };
	}
}

function writeState(state: AppState): void {
	const filePath = getStateFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(state, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Pixel Agents] Failed to write state file:', err);
	}
}

export function updateAgentSeats(
	seats: Record<string, { palette?: number; hueShift?: number; seatId?: string | null }>,
): void {
	const state = readState();
	state.agentSeats = seats;
	writeState(state);
}

export function updateSoundEnabled(enabled: boolean): void {
	const state = readState();
	state.soundEnabled = enabled;
	writeState(state);
}
