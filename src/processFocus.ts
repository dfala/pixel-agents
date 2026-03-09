import { execFile } from 'child_process';
import { PID_RESOLVE_TIMEOUT_MS } from './constants.js';

const KNOWN_TERMINALS = new Set([
	'Terminal',
	'iTerm2',
	'Alacritty',
	'alacritty',
	'kitty',
	'WezTerm',
	'wezterm-gui',
	'Hyper',
	'tmux: server',
	'screen',
	'warp',
	'Warp',
	'ghostty',
	'Ghostty',
	'WindowsTerminal',
	'Code',
	'Cursor',
	'cursor',
	'code',
	'stable', // Warp internal binary name
]);

function execAsync(cmd: string, args: string[], timeout: number): Promise<string> {
	return new Promise((resolve, reject) => {
		execFile(cmd, args, { timeout }, (err, stdout) => {
			if (err) reject(err);
			else resolve(stdout.trim());
		});
	});
}

/** PIDs already assigned to an agent, to avoid double-mapping in the same project */
const assignedPids = new Set<number>();

/**
 * Encode a filesystem path to Claude's project-hash format.
 * e.g. /Users/dfala/code/my-app → -Users-dfala-code-my-app
 */
function encodeProjectPath(fsPath: string): string {
	return fsPath.replace(/\//g, '-');
}

/**
 * Find a `claude` process whose cwd matches the given project label.
 * Claude doesn't hold JSONL files open, so we match by working directory instead.
 * The projectLabel is the encoded path (e.g. "-Users-dfala-code-my-app").
 * Skips PIDs already assigned to other agents.
 */
export async function findClaudePidForProject(projectLabel: string): Promise<number | null> {
	if (process.platform !== 'darwin' && process.platform !== 'linux') return null;

	try {
		// Find all claude processes
		const output = await execAsync('ps', ['-eo', 'pid=,comm='], PID_RESOLVE_TIMEOUT_MS);
		const claudePids: number[] = [];
		for (const line of output.split('\n')) {
			const trimmed = line.trim();
			const parts = trimmed.split(/\s+/);
			if (parts.length >= 2) {
				const comm = parts.slice(1).join(' ');
				const baseName = comm.split('/').pop() || '';
				if (baseName === 'claude') {
					const pid = parseInt(parts[0], 10);
					if (!isNaN(pid) && !assignedPids.has(pid)) {
						claudePids.push(pid);
					}
				}
			}
		}

		if (claudePids.length === 0) return null;

		// Check each claude process's cwd and encode it to match projectLabel
		for (const pid of claudePids) {
			try {
				const cwdOutput = await execAsync('lsof', ['-a', '-p', String(pid), '-d', 'cwd', '-Fn'], PID_RESOLVE_TIMEOUT_MS);
				for (const line of cwdOutput.split('\n')) {
					if (line.startsWith('n/')) {
						const cwd = line.slice(1); // remove 'n' prefix
						const encoded = encodeProjectPath(cwd);
						if (encoded === projectLabel) {
							assignedPids.add(pid);
							return pid;
						}
					}
				}
			} catch {
				// Process may have exited
			}
		}

		return null;
	} catch {
		return null;
	}
}

/**
 * Release a PID from the assigned set (when an agent is removed).
 */
export function releasePid(pid: number): void {
	assignedPids.delete(pid);
}

/**
 * Walk up the process tree to find the terminal emulator ancestor.
 * Returns { pid, appName } or null if no known terminal is found.
 */
export async function findTerminalAncestor(pid: number): Promise<{ pid: number; appName: string } | null> {
	if (process.platform !== 'darwin' && process.platform !== 'linux') return null;

	let currentPid = pid;
	const visited = new Set<number>();

	while (currentPid > 1) {
		if (visited.has(currentPid)) break;
		visited.add(currentPid);

		try {
			const output = await execAsync('ps', ['-o', 'ppid=,comm=', '-p', String(currentPid)], PID_RESOLVE_TIMEOUT_MS);
			if (!output) return null;

			const trimmed = output.trim();
			const spaceIdx = trimmed.indexOf(' ');
			if (spaceIdx === -1) return null;

			const ppid = parseInt(trimmed.slice(0, spaceIdx), 10);
			const comm = trimmed.slice(spaceIdx + 1).trim();
			const baseName = comm.split('/').pop() || comm;

			if (KNOWN_TERMINALS.has(baseName)) {
				return { pid: currentPid, appName: baseName };
			}

			currentPid = ppid;
		} catch {
			return null;
		}
	}

	return null;
}

/**
 * Check if a process is still alive.
 */
export function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Bring the terminal window to the foreground.
 */
export async function focusTerminalWindow(terminalPid: number, terminalApp: string): Promise<boolean> {
	if (process.platform === 'darwin') {
		return focusMacOS(terminalPid, terminalApp);
	}
	console.log(`[ProcessFocus] Terminal focusing not yet supported on ${process.platform}`);
	return false;
}

async function focusMacOS(_terminalPid: number, terminalApp: string): Promise<boolean> {
	const appNameMap: Record<string, string> = {
		'Terminal': 'Terminal',
		'iTerm2': 'iTerm2',
		'Alacritty': 'Alacritty',
		'alacritty': 'Alacritty',
		'kitty': 'kitty',
		'WezTerm': 'WezTerm',
		'wezterm-gui': 'WezTerm',
		'Hyper': 'Hyper',
		'warp': 'Warp',
		'Warp': 'Warp',
		'stable': 'Warp',
		'ghostty': 'Ghostty',
		'Ghostty': 'Ghostty',
		'Code': 'Visual Studio Code',
		'code': 'Visual Studio Code',
		'Cursor': 'Cursor',
		'cursor': 'Cursor',
	};

	const macAppName = appNameMap[terminalApp];
	if (!macAppName) {
		console.log(`[ProcessFocus] Unknown terminal app: ${terminalApp}`);
		return false;
	}

	try {
		await execAsync('osascript', ['-e', `tell application "${macAppName}" to activate`], PID_RESOLVE_TIMEOUT_MS);
		return true;
	} catch (err) {
		console.log(`[ProcessFocus] Failed to focus ${macAppName}:`, err);
		return false;
	}
}
