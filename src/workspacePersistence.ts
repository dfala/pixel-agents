import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { LAYOUT_FILE_DIR, WORKSPACES_FILE_NAME } from './constants.js';
import type { WorkspaceConfig } from './types.js';

function getWorkspacesFilePath(): string {
	return path.join(os.homedir(), LAYOUT_FILE_DIR, WORKSPACES_FILE_NAME);
}

export function readWorkspaceConfig(): WorkspaceConfig {
	const filePath = getWorkspacesFilePath();
	const defaults: WorkspaceConfig = { version: 1, workspaces: [] };
	try {
		if (!fs.existsSync(filePath)) return defaults;
		const raw = fs.readFileSync(filePath, 'utf-8');
		const parsed = JSON.parse(raw) as Partial<WorkspaceConfig>;
		return {
			version: 1,
			workspaces: Array.isArray(parsed.workspaces) ? parsed.workspaces : [],
		};
	} catch {
		return defaults;
	}
}

function writeWorkspaceConfig(config: WorkspaceConfig): void {
	const filePath = getWorkspacesFilePath();
	const dir = path.dirname(filePath);
	try {
		if (!fs.existsSync(dir)) {
			fs.mkdirSync(dir, { recursive: true });
		}
		const json = JSON.stringify(config, null, 2);
		const tmpPath = filePath + '.tmp';
		fs.writeFileSync(tmpPath, json, 'utf-8');
		fs.renameSync(tmpPath, filePath);
	} catch (err) {
		console.error('[Pixel Agents] Failed to write workspaces file:', err);
	}
}

export function updateWorkspaceEntry(
	projectLabel: string,
	updates: { label?: string; color?: string },
): void {
	const config = readWorkspaceConfig();
	const idx = config.workspaces.findIndex(w => w.projectLabel === projectLabel);
	if (idx >= 0) {
		const entry = config.workspaces[idx];
		if (updates.label !== undefined) entry.label = updates.label;
		if (updates.color !== undefined) entry.color = updates.color;
	} else {
		config.workspaces.push({ projectLabel, ...updates });
	}
	writeWorkspaceConfig(config);
}
