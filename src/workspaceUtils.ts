import type { WorkspaceConfig, WorkspaceInfo } from './types.js';

export const WORKSPACE_COLORS = [
	'#4ec9b0', '#ce9178', '#c586c0', '#9cdcfe',
	'#dcdcaa', '#f48771', '#89d185', '#d4d4d4',
];

/**
 * Derive a human-readable label from a Claude project hash directory name.
 * e.g. "Users-dfala-Documents-code-pixel-agents" → "pixel-agents"
 */
export function deriveDefaultLabel(projectLabel: string): string {
	const segments = projectLabel.split('-');
	let start = 0;
	// Skip platform prefix: Users-{user}, home-{user}, {drive}-Users-{user}
	if (segments[0] === 'Users' || segments[0] === 'home') {
		start = 2;
	} else if (segments.length > 2 && segments[1] === 'Users') {
		start = 3; // Windows: C-Users-{user}
	}
	const remaining = segments.slice(start);
	if (remaining.length === 0) return projectLabel;
	if (remaining.length <= 2) return remaining.join('-');
	return remaining.slice(-2).join('-');
}

/**
 * Given a list of active project labels and the workspace config,
 * resolve each to a WorkspaceInfo with a display label and color.
 * Labels are sorted alphabetically for stable color assignment.
 */
export function resolveWorkspaces(
	projectLabels: string[],
	config: WorkspaceConfig,
): Map<string, WorkspaceInfo> {
	const unique = [...new Set(projectLabels)].sort();
	const result = new Map<string, WorkspaceInfo>();

	for (let i = 0; i < unique.length; i++) {
		const pl = unique[i];
		const override = config.workspaces.find(w => w.projectLabel === pl);
		result.set(pl, {
			projectLabel: pl,
			label: override?.label || deriveDefaultLabel(pl),
			color: override?.color || WORKSPACE_COLORS[i % WORKSPACE_COLORS.length],
		});
	}

	return result;
}
