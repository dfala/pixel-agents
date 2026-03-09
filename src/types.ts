export interface TranscriptEntry {
	id: string;
	timestamp: number;
	type: 'assistant_text' | 'tool_call' | 'tool_result' | 'turn_end';
	text?: string;
	toolName?: string;
	toolArgs?: string;
	output?: string;
	isError?: boolean;
}

export interface AgentState {
	id: number;
	projectDir: string;
	projectLabel: string;
	jsonlFile: string;
	fileOffset: number;
	lineBuffer: string;
	activeToolIds: Set<string>;
	activeToolStatuses: Map<string, string>;
	activeToolNames: Map<string, string>;
	activeSubagentToolIds: Map<string, Set<string>>; // parentToolId → active sub-tool IDs
	activeSubagentToolNames: Map<string, Map<string, string>>; // parentToolId → (subToolId → toolName)
	isWaiting: boolean;
	permissionSent: boolean;
	hadToolsInTurn: boolean;
	lastActivityTime: number;
	transcriptBuffer: TranscriptEntry[];
	transcriptSeq: number;
	workspaceColor: string;
	/** PID of the `claude` process writing to the JSONL file, or null if not yet resolved */
	claudePid: number | null;
	/** PID of the terminal emulator ancestor, or null */
	terminalPid: number | null;
	/** Name of the terminal emulator process (e.g., 'iTerm2', 'Terminal') */
	terminalApp: string | null;
}

export interface NotificationEntry {
	id: number;
	agentId: number;
	type: 'permission' | 'turn_complete';
	timestamp: number;
	toolName?: string;
	read: boolean;
}

export interface WorkspaceConfig {
	version: 1;
	workspaces: Array<{
		projectLabel: string;
		label?: string;
		color?: string;
	}>;
}

export interface WorkspaceInfo {
	projectLabel: string;
	label: string;
	color: string;
}
