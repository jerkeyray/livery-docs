import type { VisualDocument, VisualNode } from '@jerkeyray/core';

export const STUDIO_CANVAS_WIDTH = 900;

export type StudioIntent = 'replace' | 'refine';

export type StudioRequirements = {
  nodes: string[];
  groups: string[];
  groupMemberships: Array<{ group: string; members: string[] }>;
  peerGroups: boolean;
  groupColumns: number | null;
  relationships: Array<{ from: string; to: string }>;
};

export type StudioRequirementIssue = {
  code: string;
  message: string;
};

export function shouldUseDraftModel(prompt: string, userMessageCount: number) {
  if (userMessageCount <= 1) return true;
  const normalized = prompt.toLowerCase();
  return prompt.length >= 220
    || /\b(create|draw|design|show|visualize|replace|start over)\b/.test(normalized)
      && /\b(architecture|system|platform|workflow|pipeline|diagram|infographic)\b/.test(normalized)
    || /\b(group|grouped|areas|boundaries|swimlanes|sections)\b/.test(normalized);
}

export function validateRequirementPlan(requirements: StudioRequirements, prompt: string): StudioRequirementIssue[] {
  const issues: StudioRequirementIssue[] = [];
  const complex = prompt.length >= 220;
  const asksForGroups = /\b(group|grouped|areas|boundaries|swimlanes|sections)\b/i.test(prompt);

  if (complex && requirements.nodes.length < 5) {
    issues.push({ code: 'requirements.nodes_incomplete', message: 'This detailed request needs at least five required nodes in the generation plan.' });
  }
  if (complex && requirements.relationships.length < 3) {
    issues.push({ code: 'requirements.relationships_incomplete', message: 'This detailed request needs at least three required relationships in the generation plan.' });
  }
  if (asksForGroups && requirements.groups.length === 0) {
    issues.push({ code: 'requirements.groups_incomplete', message: 'The user requested grouping, but the generation plan does not name any required groups.' });
  }
  const asksForPeerGroups = /\bgroup(?: it)? into\b|\b(?:separate|distinct) (?:areas|groups|frames|sections)\b/i.test(prompt);
  if (asksForPeerGroups && requirements.groups.length > 1 && !requirements.peerGroups) {
    issues.push({ code: 'requirements.peer_groups_incomplete', message: 'The user divided the system into peer areas, so peerGroups must be true.' });
  }
  const requestedColumns = prompt.match(/\b(?:use (?:a )?)?(three|four|3|4)[ -]column\b/i)?.[1];
  const expectedColumns = requestedColumns ? ({ three: 3, four: 4 }[requestedColumns.toLowerCase()] ?? Number(requestedColumns)) : undefined;
  if (expectedColumns && requirements.groupColumns !== expectedColumns) {
    issues.push({ code: 'requirements.group_columns_incomplete', message: `The user requested a ${expectedColumns}-column group layout.` });
  }
  if (!expectedColumns && requirements.groupColumns !== null) {
    issues.push({ code: 'requirements.group_columns_invented', message: 'groupColumns must be null because the user did not request an explicit column count.' });
  }
  const requiredNodes = new Set(requirements.nodes.map(normalize));
  const requiredGroups = new Set(requirements.groups.map(normalize));
  for (const membership of requirements.groupMemberships) {
    if (!requiredGroups.has(normalize(membership.group))) {
      issues.push({ code: 'requirements.membership_group_missing', message: `Membership group “${membership.group}” must also be listed as a required group.` });
    }
    for (const member of membership.members) if (!requiredNodes.has(normalize(member))) {
      issues.push({ code: 'requirements.membership_node_missing', message: `Group member “${member}” must also be listed as a required node.` });
    }
  }
  for (const relationship of requirements.relationships) {
    for (const endpoint of [relationship.from, relationship.to]) {
      if (!requiredNodes.has(normalize(endpoint))) {
        issues.push({
          code: 'requirements.relationship_endpoint_missing',
          message: `Relationship endpoint “${endpoint}” must also be listed as a required node.`,
        });
      }
    }
  }
  return issues;
}

export function validateSemanticRequirements(document: VisualDocument, requirements: StudioRequirements, prompt = ''): StudioRequirementIssue[] {
  const nodes = flatten(document.root);
  const issues: StudioRequirementIssue[] = [];
  const parents = parentMap(document.root);

  if (/\bflow\s*\(|\bflow layout\b/i.test(prompt) && document.root.layout?.kind !== 'flow') {
    issues.push({ code: 'semantic.required_flow_layout_missing', message: 'The user explicitly requested flow(...), so the outer composition must use a flow layout.' });
  }

  for (const label of requirements.nodes) {
    if (!matchingNodes(nodes, label).length) {
      issues.push({ code: 'semantic.missing_required_node', message: `Required node “${label}” is missing from the diagram.` });
    }
  }

  for (const label of requirements.groups) {
    if (!matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), label).length) {
      issues.push({ code: 'semantic.missing_required_group', message: `Required group “${label}” is missing or is not represented by a frame.` });
    }
  }

  const requiredFrames = requirements.groups.flatMap((label) => matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), label).slice(0, 1));
  if (requirements.peerGroups && requiredFrames.length > 1) {
    const parentIds = new Set(requiredFrames.map(({ id }) => parents.get(id)));
    if (parentIds.size !== 1) {
      issues.push({ code: 'semantic.required_groups_not_peers', message: 'Requested peer groups must be sibling frames; do not nest one requested area inside another.' });
    }
  }
  if (requirements.groupColumns && requiredFrames.length > 1) {
    const parentId = parents.get(requiredFrames[0]!.id);
    const parent = nodes.find(({ id }) => id === parentId);
    if (!parent || parent.layout?.kind !== 'grid' || parent.layout.columns !== requirements.groupColumns) {
      issues.push({ code: 'semantic.required_group_columns_missing', message: `Requested peer groups must use a ${requirements.groupColumns}-column grid.` });
    }
  }

  for (const membership of requirements.groupMemberships) {
    const group = matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), membership.group)[0];
    if (!group) continue;
    const descendants = flatten(group).slice(1);
    for (const member of membership.members) if (!matchingNodes(descendants, member).length) {
      issues.push({ code: 'semantic.required_group_member_missing', message: `Required node “${member}” must be inside the “${membership.group}” group.` });
    }
  }

  for (const relationship of requirements.relationships) {
    const from = new Set(matchingNodes(nodes, relationship.from).map(({ id }) => id));
    const to = new Set(matchingNodes(nodes, relationship.to).map(({ id }) => id));
    if (!from.size || !to.size) {
      issues.push({
        code: 'semantic.missing_required_relationship',
        message: `Required relationship “${relationship.from} → ${relationship.to}” cannot be validated because an endpoint is missing.`,
      });
      continue;
    }
    const connected = document.connectors.some((connector) => from.has(connector.from.node) && to.has(connector.to.node));
    if (!connected) {
      issues.push({
        code: 'semantic.missing_required_relationship',
        message: `Required relationship “${relationship.from} → ${relationship.to}” is missing or points in the wrong direction.`,
      });
    }
  }

  if (/\brestrained colou?r\b|\bcolou?r only for\b/i.test(prompt)) {
    const colored = nodes.filter((node) => node.kind !== 'frame' && node.id !== document.root.id && (
      node.tone && node.tone !== 'neutral'
      || node.variant === 'solid'
      || node.variant === 'emphasis'
      || node.style?.fill !== undefined
      || node.style?.stroke !== undefined
      || node.style?.iconColor !== undefined
    ));
    if (colored.length > 2) {
      issues.push({ code: 'semantic.excessive_color', message: `Restrained color was requested, but ${colored.length} components are emphasized. Keep most components neutral and color at most two focal nodes.` });
    }
  }

  return issues;
}

export function createRequirementRepairPrompt(issues: StudioRequirementIssue[]) {
  return [
    'The source compiles, but it does not yet satisfy the requested diagram.',
    'Repair the complete source and call submit_livery again. Preserve requirements that already pass.',
    ...issues.slice(0, 8).map(({ code, message }) => `- [${code}] ${message}`),
  ].join('\n');
}

function flatten(node: VisualNode): VisualNode[] {
  return [node, ...(node.children?.flatMap(flatten) ?? [])];
}

function parentMap(root: VisualNode) {
  const parents = new Map<string, string | undefined>();
  const visit = (node: VisualNode, parentId?: string) => {
    parents.set(node.id, parentId);
    node.children?.forEach((child) => visit(child, node.id));
  };
  visit(root);
  return parents;
}

function matchingNodes(nodes: VisualNode[], requestedLabel: string) {
  const expected = normalize(requestedLabel);
  return nodes.filter(({ label }) => {
    const actual = normalize(label ?? '');
    return actual === expected
      || expected.length >= 4 && actual.includes(expected)
      || actual.length >= 4 && expected.includes(actual);
  });
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
