import type { VisualDocument, VisualNode } from '@jerkeyray/core';

export const STUDIO_CANVAS_WIDTH = 900;

export type StudioIntent = 'replace' | 'refine';

export type StudioRequirements = {
  family?: string;
  nodes: string[];
  groups: string[];
  groupMemberships: Array<{ group: string; members: string[] }>;
  groupHeads: Array<{ group: string; head: string | null }>;
  peerGroups: boolean;
  groupColumns: number | null;
  relationships: Array<{ from: string; to: string; kind: 'reporting' | 'supporting' | 'advisory' }>;
};

export function classifyVisualFamily(prompt: string) {
  const value = prompt.toLowerCase();
  if (/\b(sequence|request[- ]response|interaction narrative|participants? exchange)\b/.test(value)) return 'sequence';
  if (/\b(state machine|state transition|lifecycle)\b/.test(value)) return 'state-model';
  if (/\b(class diagram|class model|inheritance|methods? and fields?)\b/.test(value)) return 'class-model';
  if (/\b(entity relationship|er diagram|database schema|cardinalit(?:y|ies))\b/.test(value)) return 'entity-model';
  if (/\b(requirements?|verification|traceability|sysml)\b/.test(value)) return 'requirement-model';
  if (/\b(governance|org(?:anizational)? chart|taxonomy|decision tree|reporting structure|hierarchy)\b/.test(value)) return 'tree-view';
  if (/\b(gantt|schedule|milestone|duration)\b/.test(value)) return 'schedule';
  if (/\b(pie|proportion|share of)\b/.test(value)) return 'proportion';
  if (/\b(line chart|bar chart|area chart|xy plot)\b/.test(value)) return 'xy-plot';
  if (/\b(architecture|system|platform|service map|cloud)\b/.test(value)) return 'architecture';
  return 'flowchart';
}

export type StudioRequirementIssue = {
  code: string;
  message: string;
};

export function shouldUseDraftModel(prompt: string, userMessageCount: number) {
  if (userMessageCount <= 1) return true;
  const normalized = prompt.toLowerCase();
  return prompt.length >= 220
    || /\b(create|draw|design|show|visualize|replace|start over)\b/.test(normalized)
      && /\b(architecture|system|platform|workflow|pipeline|diagram|infographic|governance|org chart|taxonomy|decision tree|hierarchy|sequence|interaction|state machine|class model|database schema|requirements?)\b/.test(normalized)
    || /\b(group|grouped|areas|boundaries|swimlanes|sections|governance|org chart|taxonomy|decision tree|hierarchy|sequence|interaction|state machine|class model|database schema|requirements?)\b/.test(normalized);
}

export function validateRequirementPlan(requirements: StudioRequirements, prompt: string): StudioRequirementIssue[] {
  const issues: StudioRequirementIssue[] = [];
  const complex = prompt.length >= 220;
  const asksForGroups = /\b(group|grouped|areas|boundaries|swimlanes|sections|divisions?|schools?)\b/i.test(prompt);
  const expectedFamily = classifyVisualFamily(prompt);
  if (requirements.family && requirements.family !== expectedFamily) {
    issues.push({ code: 'requirements.visual_family_mismatch', message: `This request is classified as ${expectedFamily}, not ${requirements.family}.` });
  }

  if (complex && requirements.nodes.length < 5) {
    issues.push({ code: 'requirements.nodes_incomplete', message: 'This detailed request needs at least five required nodes in the generation plan.' });
  }
  if (complex && requirements.relationships.length < 3) {
    issues.push({ code: 'requirements.relationships_incomplete', message: 'This detailed request needs at least three required relationships in the generation plan.' });
  }
  if (asksForGroups && requirements.groups.length === 0) {
    issues.push({ code: 'requirements.groups_incomplete', message: 'The user requested grouping, but the generation plan does not name any required groups.' });
  }
  const asksForPeerGroups =
    /\bgroup(?: it)? into\b|\b(?:separate|distinct) (?:areas|groups|frames|sections)\b|\bsibling (?:areas|groups|frames|sections|divisions?|schools?)\b/i.test(
      prompt,
    );
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
  const requiredEndpoints = new Set([...requiredNodes, ...requiredGroups]);
  const hierarchyRequested = /\b(hierarchy|governance|org(?:anizational)? chart|taxonomy|decision tree|reporting structure)\b/i.test(prompt);
  for (const label of requirements.nodes) if (requiredGroups.has(normalize(label))) {
    issues.push({
      code: 'requirements.entity_group_overlap',
      message: `“${label}” cannot be both a node and a group. Keep the frame in groups and use its named leader as groupHead, or null for the frame's implicit hierarchy pin.`,
    });
  }
  for (const membership of requirements.groupMemberships) {
    if (!requiredGroups.has(normalize(membership.group))) {
      issues.push({ code: 'requirements.membership_group_missing', message: `Membership group “${membership.group}” must also be listed as a required group.` });
    }
    for (const member of membership.members) if (!requiredEndpoints.has(normalize(member))) {
      issues.push({ code: 'requirements.membership_endpoint_missing', message: `Group member “${member}” must also be listed as a required node or nested group.` });
    } else if (normalize(member) === normalize(membership.group)) {
      issues.push({ code: 'requirements.membership_self_reference', message: `Group “${membership.group}” cannot contain itself.` });
    }
  }
  for (const groupHead of requirements.groupHeads ?? []) {
    if (!requiredGroups.has(normalize(groupHead.group))) {
      issues.push({ code: 'requirements.group_head_group_missing', message: `Group head “${groupHead.group}” must also be listed as a required group.` });
    }
    if (groupHead.head !== null && !requiredNodes.has(normalize(groupHead.head))) {
      issues.push({ code: 'requirements.group_head_node_missing', message: `Named group head “${groupHead.head}” must also be listed as a required node.` });
    }
  }
  for (const relationship of requirements.relationships) {
    for (const endpoint of [relationship.from, relationship.to]) {
      if (!requiredEndpoints.has(normalize(endpoint))) {
        issues.push({
          code: 'requirements.relationship_endpoint_missing',
          message: `Relationship endpoint “${endpoint}” must also be listed as a required node or group.`,
        });
      }
    }
    const ownMembership = requirements.groupMemberships.find(({ group }) => normalize(group) === normalize(relationship.from));
    if ((relationship.kind ?? 'reporting') === 'reporting' && ownMembership?.members.some((member) => normalize(member) === normalize(relationship.to))) {
      issues.push({
        code: 'requirements.frame_descendant_relationship_invalid',
        message: `Containment “${relationship.from} contains ${relationship.to}” belongs only in groupMemberships. Do not add a reporting relationship from a frame to its own member; use a named leader when one exists.`,
      });
    }
  }
  if (hierarchyRequested) {
    const reporting = requirements.relationships.filter(({ kind }) => kind === 'reporting');
    if (!reporting.length) {
      issues.push({ code: 'requirements.reporting_relationships_missing', message: 'A hierarchy needs explicit reporting relationships; containment and advisory links cannot replace its reporting tree.' });
    }
    const nestedGroups = new Set(requirements.groupMemberships.flatMap(({ members }) => members).map(normalize).filter((member) => requiredGroups.has(member)));
    const topLevelGroups = requirements.groups.filter((group) => !nestedGroups.has(normalize(group)));
    if (requirements.peerGroups) for (const group of topLevelGroups) {
      if (!reporting.some(({ to }) => normalize(to) === normalize(group))) {
        issues.push({ code: 'requirements.peer_group_reporting_parent_missing', message: `Sibling hierarchy group “${group}” needs one incoming reporting relationship from its parent entity.` });
      }
    }
    for (const groupHead of requirements.groupHeads ?? []) {
      if (!groupHead.head) continue;
      const membership = requirements.groupMemberships.find(({ group }) => normalize(group) === normalize(groupHead.group));
      for (const subgroup of membership?.members.filter((member) => requiredGroups.has(normalize(member))) ?? []) {
        if (!reporting.some(({ from, to }) => normalize(from) === normalize(groupHead.head!) && normalize(to) === normalize(subgroup))) {
          issues.push({ code: 'requirements.group_head_reporting_missing', message: `Group head “${groupHead.head}” must report to nested hierarchy group “${subgroup}”.` });
        }
      }
    }
    const contained = new Set(requirements.groupMemberships.flatMap(({ members }) => members).map(normalize));
    const reportingEndpoints = new Set(reporting.flatMap(({ from, to }) => [normalize(from), normalize(to)]));
    const advisoryEndpoints = new Set(requirements.relationships.filter(({ kind }) => kind === 'advisory').flatMap(({ from, to }) => [normalize(from), normalize(to)]));
    for (const node of requirements.nodes) {
      const normalized = normalize(node);
      if (!contained.has(normalized) && !reportingEndpoints.has(normalized) && !advisoryEndpoints.has(normalized)) {
        issues.push({ code: 'requirements.hierarchy_node_disconnected', message: `Top-level hierarchy node “${node}” must participate in the reporting tree or an advisory relationship.` });
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
  if (/\b(hierarchy|governance|org(?:anizational)? chart|taxonomy|decision tree|reporting structure)\b/i.test(prompt) && document.root.layout?.kind !== 'hierarchy') {
    issues.push({ code: 'semantic.required_hierarchy_layout_missing', message: 'This reporting structure must use hierarchy(...) for the outer composition.' });
  }
  if ((requirements.family === 'sequence' || classifyVisualFamily(prompt) === 'sequence') && document.root.layout?.kind !== 'interaction') {
    issues.push({ code: 'semantic.required_interaction_layout_missing', message: 'An ordered participant narrative must use interaction(...) for native lifelines and message rows.' });
  }
  const family = requirements.family ?? classifyVisualFamily(prompt);
  if (family === 'sequence') {
    const participants = nodes.filter(({ kind }) => kind === 'lib.participant');
    const messages = document.connectors.filter(({ semantic }) => semantic === 'message');
    if (participants.length < 2) issues.push({ code: 'semantic.interaction_participants_missing', message: 'An interaction narrative needs at least two participant(...) components.' });
    if (!messages.length) issues.push({ code: 'semantic.interaction_messages_missing', message: 'An interaction narrative needs ordered semantic message connectors.' });
    const orders = messages.map(({ order }) => order).filter((order): order is number => order !== undefined).sort((a, b) => a - b);
    if (orders.length !== messages.length || orders.some((order, index) => order !== index)) issues.push({ code: 'semantic.interaction_order_invalid', message: 'Interaction message order must be explicit, unique, and contiguous from zero.' });
  }
  if (family === 'class-model' && !nodes.some(({ kind }) => kind === 'lib.classCard')) issues.push({ code: 'semantic.class_cards_missing', message: 'A class model must use classCard(...) with structured fields or methods.' });
  if (family === 'entity-model' && !nodes.some(({ kind }) => kind === 'lib.entity')) issues.push({ code: 'semantic.entities_missing', message: 'An entity model must use entity(...) with structured fields.' });
  if (family === 'state-model') {
    if (!nodes.some(({ kind }) => kind === 'lib.stateNode')) issues.push({ code: 'semantic.states_missing', message: 'A state model must use stateNode(...) components.' });
    if (!document.connectors.some(({ semantic }) => semantic === 'transition')) issues.push({ code: 'semantic.transitions_missing', message: 'A state model must use transition-semantic connectors.' });
  }
  if (family === 'requirement-model') {
    if (!nodes.some(({ kind }) => kind === 'lib.requirement')) issues.push({ code: 'semantic.requirements_missing', message: 'A requirement model must use requirement(...) components.' });
    if (!document.connectors.some(({ semantic }) => semantic === 'trace' || semantic === 'verify' || semantic === 'satisfy')) issues.push({ code: 'semantic.traceability_missing', message: 'A requirement model needs trace, verify, or satisfy relationships.' });
  }

  for (const label of requirements.nodes) {
    const matches = matchingNodes(nodes, label);
    if (!matches.length) {
      issues.push({ code: 'semantic.missing_required_node', message: `Required node “${label}” is missing from the diagram.` });
    } else if (matches.every(({ kind }) => kind === 'frame')) {
      issues.push({ code: 'semantic.required_node_rendered_as_group', message: `Required entity “${label}” must be a card/component, not a frame used to encode reporting.` });
    }
  }

  for (const label of requirements.groups) {
    if (!matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), label).length) {
      issues.push({ code: 'semantic.missing_required_group', message: `Required group “${label}” is missing or is not represented by a frame.` });
    }
  }

  const nestedGroups = new Set(requirements.groupMemberships.flatMap(({ members }) => members).map(normalize).filter((member) => requirements.groups.some((group) => normalize(group) === member)));
  const peerGroupLabels = requirements.groups.filter((group) => !nestedGroups.has(normalize(group)));
  const peerFrames = peerGroupLabels.flatMap((label) => matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), label).slice(0, 1));
  if (requirements.peerGroups && peerFrames.length > 1) {
    const parentIds = new Set(peerFrames.map(({ id }) => parents.get(id)));
    if (parentIds.size !== 1) {
      issues.push({ code: 'semantic.required_groups_not_peers', message: 'Requested peer groups must be sibling frames; do not nest one requested area inside another.' });
    }
  }
  if (requirements.groupColumns && peerFrames.length > 1) {
    const parentId = parents.get(peerFrames[0]!.id);
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
      issues.push({ code: 'semantic.required_group_member_missing', message: `Required node or nested group “${member}” must be inside the “${membership.group}” group.` });
    }
  }

  for (const relationship of requirements.relationships) {
    const from = resolveRelationshipEndpoint(nodes, requirements, relationship.from);
    const to = resolveRelationshipEndpoint(nodes, requirements, relationship.to);
    if (!from.size || !to.size) {
      issues.push({
        code: 'semantic.missing_required_relationship',
        message: `Required relationship “${relationship.from} → ${relationship.to}” cannot be validated because an endpoint is missing.`,
      });
      continue;
    }
    const kind = relationship.kind ?? 'reporting';
    const connected = document.connectors.some((connector) => from.has(connector.from.node) && to.has(connector.to.node)
      && (kind === 'advisory'
        ? connector.variant === 'advisory'
        : kind === 'supporting'
          ? connector.variant !== 'advisory' && connector.role === 'supporting'
          : connector.variant !== 'advisory' && connector.role !== 'supporting'));
    if (!connected) {
      issues.push({
        code: 'semantic.missing_required_relationship',
        message: `Required ${kind} relationship “${relationship.from} → ${relationship.to}” is missing, has the wrong variant, or points in the wrong direction.`,
      });
    }
  }

  if (/\brestrained colou?r\b|\bcolou?r restrained\b|\bcolou?r only for\b/i.test(prompt)) {
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

function resolveRelationshipEndpoint(nodes: VisualNode[], requirements: StudioRequirements, label: string) {
  const direct = matchingNodes(nodes.filter(({ kind }) => kind !== 'frame'), label);
  if (direct.length) return new Set(direct.map(({ id }) => id));
  const frame = matchingNodes(nodes.filter(({ kind }) => kind === 'frame'), label)[0];
  if (!frame) return new Set<string>();
  const head = (requirements.groupHeads ?? []).find(({ group }) => normalize(group) === normalize(label));
  if (!head || head.head === null) return new Set([frame.id]);
  return new Set([frame.id, ...matchingNodes(flatten(frame).slice(1), head.head).map(({ id }) => id)]);
}

export function createRequirementRepairPrompt(issues: StudioRequirementIssue[], prompt = '') {
  return [
    'The source compiles, but it does not yet satisfy the requested diagram.',
    'Repair the complete source and call submit_livery again. Preserve requirements that already pass.',
    ...studioRepairRules(prompt),
    ...issues.slice(0, 8).map(({ code, message }) => `- [${code}] ${message}`),
  ].join('\n');
}

export function createStudioCompilerRepairPrompt(basePrompt: string, prompt = '') {
  return [basePrompt, '', 'Studio repair invariants:', ...studioRepairRules(prompt)].join('\n');
}

function studioRepairRules(prompt: string) {
  const hierarchy = /\b(hierarchy|governance|org(?:anizational)? chart|taxonomy|decision tree|reporting structure)\b/i.test(prompt);
  return [
    '- Keep exactly one root layout call at the end of the figure. Include every top-level card and frame in it.',
    '- row, column, flow, hierarchy, and stack are layout calls, never components or assigned bindings.',
    '- A frame owns its children through layout: column, layout: row, or layout: hierarchy; do not add a second root layout for them.',
    '- Every connector to a nested child must use its fully qualified ID, such as academic.provost or academic.science.',
    '- Put containment only in groupMemberships. A frame must never have a reporting connector to one of its own members.',
    '- Never encode reporting by nesting one entity frame inside another. People, boards, councils, and named roles are cards; only requested divisions, schools, areas, or boundaries are frames.',
    '- Words such as above, under, reports to, leads, and followed by describe reporting relationships. They require connectors and must not be converted into containment.',
    '- Never list the same label in both nodes and groups, and never add a duplicate card just to make a frame usable as a relationship endpoint. Frames already expose an implicit hierarchy pin.',
    '- Frames are quiet containers: do not pass variant or tone to frame(...). Style or emphasize the cards inside them.',
    ...(hierarchy ? [
      '- The single root layout must be hierarchy(..., direction: down). Never replace it with row, column, grid, or flow during repair.',
      '- Connect an external parent to a child frame implicit pin; connect a leader inside that frame to nested subgroup frames.',
      '- Every top-level sibling frame needs exactly one incoming reporting connector. A named group head needs reporting connectors to each nested subgroup frame.',
      '- Keep reporting connectors primary or secondary and advice connectors variant: advisory.',
      '- In a taxonomy, ranks and named taxa are cards unless the user explicitly requests visual group regions.',
    ] : []),
  ];
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
