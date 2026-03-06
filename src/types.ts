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
}
