import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CLAUDE_PROJECTS_DIR, SESSION_STALENESS_MS } from './constants.js';

export interface DiscoveredSession {
	jsonlFile: string;
	projectDir: string;
	projectLabel: string;
	mtime: number;
}

/**
 * Scan ~/.claude/projects/ for all active JSONL sessions.
 * A session is "active" if its JSONL file was modified within SESSION_STALENESS_MS.
 */
export function scanAllProjects(): DiscoveredSession[] {
	const baseDir = path.join(os.homedir(), CLAUDE_PROJECTS_DIR);
	const sessions: DiscoveredSession[] = [];
	const now = Date.now();

	let projectDirs: string[];
	try {
		projectDirs = fs.readdirSync(baseDir, { withFileTypes: true })
			.filter(d => d.isDirectory())
			.map(d => d.name);
	} catch {
		return sessions;
	}

	for (const dirName of projectDirs) {
		const projectDir = path.join(baseDir, dirName);
		let files: string[];
		try {
			files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
		} catch {
			continue;
		}

		for (const file of files) {
			const fullPath = path.join(projectDir, file);
			try {
				const stat = fs.statSync(fullPath);
				if (now - stat.mtimeMs < SESSION_STALENESS_MS) {
					sessions.push({
						jsonlFile: fullPath,
						projectDir,
						projectLabel: dirName,
						mtime: stat.mtimeMs,
					});
				}
			} catch {
				continue;
			}
		}
	}

	return sessions;
}
