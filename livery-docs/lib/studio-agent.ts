import type { VisualDocument, VisualNode } from '@jerkeyray/core';

export type StudioIntent = 'replace' | 'refine';

export type StudioRequirements = {
  nodes: string[];
  groups: string[];
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
  const requiredNodes = new Set(requirements.nodes.map(normalize));
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

export function validateSemanticRequirements(document: VisualDocument, requirements: StudioRequirements): StudioRequirementIssue[] {
  const nodes = flatten(document.root);
  const issues: StudioRequirementIssue[] = [];

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
