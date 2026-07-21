import { describe, expect, test } from 'bun:test';
import { compileProgram } from 'liveryscript';
import {
  createRequirementRepairPrompt,
  createStudioCompositionRules,
  createStudioCompilerRepairPrompt,
  classifyVisualFamily,
  normalizeVisualPlanRequest,
  shouldUseDraftModel,
  shouldUseVisualPlan,
  retainVisualPlanForSource,
  validateRequirementPlan,
  validateSemanticRequirements,
  validateVisualPlanRequest,
} from './studio-agent';

const source = `figure checkout("Checkout") {
  client = frame("Client", layout: column) {
    web = browser("Web app")
  }
  application = frame("Application", layout: column) {
    api = api("API gateway")
    orders = service("Order service")
  }
  request = connect(client.web.right, application.api.left, label: "checkout")
  dispatch = connect(application.api.bottom, application.orders.top, label: "dispatch")
  row(client, application)
}`;

describe('Studio generation contract', () => {
  test('routes common connected visuals through semantic plans and preserves specialized DSL families', () => {
    expect(shouldUseVisualPlan('Explain a token bucket rate limiter with accepted and rejected API requests.')).toBe(true);
    expect(shouldUseVisualPlan('Show an OAuth request-response sequence.')).toBe(false);
    expect(shouldUseVisualPlan('Draw a B-tree hierarchy.')).toBe(false);
    expect(shouldUseVisualPlan('Show a nested application hierarchy.')).toBe(false);
    expect(shouldUseVisualPlan('Explain nested retries between an API and cache.')).toBe(true);
    expect(shouldUseVisualPlan('Make the cards wider and use dashed arrows.')).toBe(false);
    expect(shouldUseVisualPlan('Create a token bucket explainer. Composition requirements: use exactly five nodes and a left-to-right flow.')).toBe(true);
    expect(shouldUseVisualPlan('Create a token bucket explainer. Keep all text inside its allocated bounds and do not cross a card border.')).toBe(true);
    const plan = { type: 'livery.plan', version: '0.1', id: 'existing', family: 'process', direction: 'auto', nodes: [{ id: 'a', label: 'A', kind: 'process' }], edges: [], annotations: [], groups: [] };
    expect(shouldUseVisualPlan('Move Rejected below the token bucket.', plan)).toBe(false);
    expect(shouldUseVisualPlan('Rename A', plan)).toBe(true);
    expect(shouldUseVisualPlan('Rename A', undefined, true)).toBe(false);
    expect(shouldUseVisualPlan('Create a new API flow', undefined, false)).toBe(true);
    expect(retainVisualPlanForSource(plan, 'same', 'same')).toBe(plan);
    expect(retainVisualPlanForSource(plan, 'manual edit', 'accepted')).toBeUndefined();
  });

  test('classifies original visual families before drafting', () => {
    expect(classifyVisualFamily('Show a request-response sequence between a client and API.')).toBe('sequence');
    expect(classifyVisualFamily('Model account and invoice cardinalities in a database schema.')).toBe('entity-model');
    expect(classifyVisualFamily('Draw an order lifecycle state machine.')).toBe('state-model');
    expect(classifyVisualFamily('Map requirements to verification evidence.')).toBe('requirement-model');
    expect(classifyVisualFamily('Create a token bucket explainer. Composition requirements: use exactly five nodes.')).toBe('flowchart');
    expect(classifyVisualFamily('Draw a tree diagram explaining B-trees.')).toBe('tree-view');
    expect(classifyVisualFamily('Make a simple API flow with a gateway, DB, and cache.')).toBe('architecture');
    expect(classifyVisualFamily('Explain how Raft leader elections work.')).toBe('sequence');
    expect(classifyVisualFamily('Explain request duration through an API and cache.')).toBe('architecture');
  });

  test('validates exact semantic-plan content against the active request', () => {
    const prompt = `Create a technical explainer titled “Exact Flow”. Use a left-to-right layout. Use exactly two nodes:
1. “Incoming” - Kind: client - No subtitle - No annotations
2. “Accepted” - Kind: outcome - Success status - No subtitle - Include exactly one inline annotation:
- “HTTP 200”
Use exactly these relationships:
- Incoming → Accepted
- Edge kind: flow
- Label: “allow”
Use no groups.`;
    const plan = {
      type: 'livery.plan', version: '0.1', id: 'exact', title: 'Exact Flow', family: 'process', direction: 'right',
      nodes: [{ id: 'incoming', label: 'Incoming', kind: 'client' }, { id: 'accepted', label: 'Accepted', kind: 'outcome', status: 'success' }],
      edges: [{ id: 'allow', from: 'incoming', to: 'accepted', kind: 'flow', label: 'allow' }],
      annotations: [{ id: 'http', target: 'accepted', text: 'HTTP 200', kind: 'fact' }], groups: [],
    };
    expect(validateVisualPlanRequest(plan, prompt)).toEqual([]);
    const polluted = { ...plan, title: 'Wrong title', direction: 'down', nodes: plan.nodes.map((node) => ({ ...node, subtitle: `Generic ${node.label} explanation` })) };
    expect(validateVisualPlanRequest(polluted, prompt).map(({ code }) => code))
      .toEqual(expect.arrayContaining(['plan.request.title_mismatch', 'plan.request.direction_mismatch', 'plan.request.subtitle_forbidden']));
    const normalized = normalizeVisualPlanRequest(polluted, prompt);
    expect(normalized.title).toBe('Exact Flow');
    expect(normalized.direction).toBe('right');
    expect(normalized.nodes.every((node) => node.subtitle === undefined)).toBe(true);
    expect(validateVisualPlanRequest(normalized, prompt)).toEqual([]);
    expect(validateVisualPlanRequest({ ...plan, nodes: plan.nodes.slice(0, 1), edges: [] }, prompt).map(({ code }) => code))
      .toEqual(expect.arrayContaining(['plan.request.node_count', 'plan.request.node_missing', 'plan.request.edge_missing']));

    const unlabeledPrompt = `Use exactly these relationships:
- Incoming → Accepted`;
    expect(validateVisualPlanRequest({ ...plan, edges: [] }, unlabeledPrompt).map(({ code }) => code))
      .toEqual(expect.arrayContaining(['plan.request.edge_missing', 'plan.request.edge_count']));
  });

  test('silently expands terse requests into a strong visual brief', () => {
    const rules = createStudioCompositionRules('Make a simple API flow with a gateway, DB, and cache.').join('\n');
    expect(rules).toContain('silently expand the request into an internal visual brief');
    expect(rules).toContain('compact landscape composition');
    expect(rules).toContain('database for caches and datastores');
    expect(rules).toContain('never place loose icons beside labels');
  });

  test('repairs explicit peer grids without binding layouts or changing topology', () => {
    const repair = createStudioCompilerRepairPrompt(
      '[semantic.unknown_component] Unknown component grid.\n[layout.routing_exhausted] No valid route is available.',
      'Arrange four sibling frames as a compact 2×2 composition and keep advisory feedback inside the middle.',
    );
    expect(repair).toContain('grid, flow, hierarchy, interaction, stack, and overlay are layout calls');
    expect(repair).toContain('does not authorize replacing an explicitly requested peer-frame grid');
    expect(repair).toContain('Keep advisory feedback in those center gutters');
    expect(repair).toContain('component widths at or below 140');
    expect(repair).toContain('one shared bundleId across those edges');
    expect(repair).toContain('layout: grid, columns: 2, gap: xs, padding: sm');
    expect(repair).toContain('do not substitute a column layout');

    const draftRules = createStudioCompositionRules(
      'Create an architecture with four sibling frames in a compact 2×2 composition.',
    ).join('\n');
    expect(draftRules).toContain('never boundary(...)');
    expect(draftRules).toContain('component widths at or below 140');
    expect(draftRules).toContain('one shared corridor bundleId');
    expect(draftRules).toContain('Use this syntax shape literally');
  });

  test('rejects floating and ghost systems in terse architecture drafts', () => {
    const prompt = 'Make a simple API flow with a gateway, DB, and cache.';
    const requirements = {
      family: 'architecture',
      nodes: ['Client', 'Gateway', 'API', 'Cache', 'DB'],
      groups: [],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [
        { from: 'Client', to: 'Gateway', kind: 'reporting' },
        { from: 'Gateway', to: 'API', kind: 'reporting' },
        { from: 'API', to: 'Cache', kind: 'supporting' },
      ],
    };
    const weak = compileProgram(`figure api_flow {
      client = browser("Client", variant: muted)
      gateway = api("Gateway", variant: soft, tone: info)
      service = service("API", variant: muted)
      cache = database("Cache", variant: ghost)
      db = database("DB", variant: ghost)
      connect(client.right, gateway.left, role: primary)
      connect(gateway.right, service.left, role: primary)
      connect(service.right, cache.left, role: supporting)
      connect(service.right, db.left, role: supporting)
      flow(client, gateway, service, cache, db, direction: right)
    }`);
    expect(weak.diagnostics).toEqual([]);
    expect(validateSemanticRequirements(weak.document, requirements, prompt).map(({ code }) => code))
      .toContain('semantic.architecture_nodes_unbounded');

    const bounded = compileProgram(`figure api_flow {
      client = browser("Client", variant: muted)
      gateway = api("Gateway", variant: soft, tone: info)
      service = service("API", variant: muted)
      cache = database("Cache", variant: muted)
      db = database("DB", variant: muted)
      connect(client.right, gateway.left, role: primary)
      connect(gateway.right, service.left, role: primary)
      connect(service.right, cache.left, role: supporting)
      connect(service.right, db.left, role: supporting)
      flow(client, gateway, service, cache, db, direction: right)
    }`);
    expect(bounded.diagnostics).toEqual([]);
    expect(validateSemanticRequirements(bounded.document, requirements, prompt)).toEqual([]);
  });

  test('defaults terse architectures to a landscape flow but preserves explicit composition', () => {
    const requirements = {
      family: 'architecture', nodes: ['Client', 'API', 'DB'], groups: [], groupMemberships: [], groupHeads: [], peerGroups: false, groupColumns: null,
      relationships: [{ from: 'Client', to: 'API', kind: 'reporting' }, { from: 'API', to: 'DB', kind: 'supporting' }],
    };
    const column = compileProgram(`figure api { client = browser("Client") api = api("API") db = database("DB") connect(client.bottom, api.top, role: primary) connect(api.bottom, db.top, role: primary) column(client, api, db) }`);
    expect(validateSemanticRequirements(column.document, requirements, 'Show an API with a client and DB.').map(({ code }) => code))
      .toContain('semantic.architecture_flow_missing');
    expect(validateSemanticRequirements(column.document, requirements, 'Use a vertical column layout for an API with a client and DB.').map(({ code }) => code))
      .not.toContain('semantic.architecture_flow_missing');

    const auto = compileProgram(`figure api { client = browser("Client") api = api("API") db = database("DB") connect(client.right, api.left, role: primary) connect(api.right, db.left, role: primary) flow(client, api, db, direction: auto) }`);
    expect(validateSemanticRequirements(auto.document, requirements, 'Show an API with a client and DB.').map(({ code }) => code))
      .toContain('semantic.architecture_landscape_missing');
  });

  test('requires data-tree requests to draw concrete keys and real branching', () => {
    const requirements = {
      family: 'tree-view',
      nodes: [],
      groups: [],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [],
    };
    const conceptMap = compileProgram(`figure bad_tree("B-Tree tree") {
      overview = card("B-Tree")
      root = card("Root Node")
      leaf = card("Leaf Node")
      rootEdge = connect(overview.bottom, root.top, role: primary)
      leafEdge = connect(root.bottom, leaf.top, role: primary)
      hierarchy(overview, root, leaf, direction: down)
    }`);
    expect(validateSemanticRequirements(conceptMap.document, requirements, 'Draw a tree diagram explaining B-trees.').map(({ code }) => code))
      .toContain('semantic.data_tree_key_nodes_missing');

    const structuralTree = compileProgram(`figure b_tree("B-tree example") {
      root = card("[30 | 60]", subtitle: "separator keys")
      left = card("[5 | 15]", subtitle: "leaf · < 30")
      middle = card("[35 | 50]", subtitle: "leaf · 30–60")
      right = card("[70 | 90]", subtitle: "leaf · > 60")
      a = connect(root.bottom, left.top, role: primary)
      b = connect(root.bottom, middle.top, role: primary)
      c = connect(root.bottom, right.top, role: primary)
      hierarchy(root, left, middle, right, direction: down)
    }`);
    expect(structuralTree.diagnostics).toEqual([]);
    expect(validateSemanticRequirements(structuralTree.document, requirements, 'Draw a tree diagram explaining B-trees.')).toEqual([]);
  });

  test('requires the native interaction kernel for ordered participant narratives', () => {
    const requirements = {
      family: 'sequence',
      nodes: ['Client', 'API'],
      groups: [],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'Client', to: 'API', kind: 'reporting' }],
    };
    const wrong = compileProgram(`figure exchange { client = participant("Client") api = participant("API") request = connect(client.right, api.left, semantic: message, order: 0) row(client, api) }`);
    expect(validateSemanticRequirements(wrong.document, requirements, 'Show a request-response sequence.').map(({ code }) => code)).toContain('semantic.required_interaction_layout_missing');
    const correct = compileProgram(`figure exchange { client = participant("Client") api = participant("API") request = connect(client.right, api.left, semantic: message, order: 0) interaction(client, api) }`);
    expect(validateSemanticRequirements(correct.document, requirements, 'Show a request-response sequence.')).toEqual([]);
  });

  test('rejects visually plausible but semantically empty schema and behavior drafts', () => {
    const base = { nodes: [], groups: [], groupMemberships: [], groupHeads: [], peerGroups: false, groupColumns: null, relationships: [] };
    const cards = compileProgram(`figure model { a = card("Account") b = card("Invoice") edge = connect(a.right, b.left) flow(a, b) }`);
    expect(validateSemanticRequirements(cards.document, { ...base, family: 'entity-model' }, 'Show an entity relationship model.').map(({ code }) => code)).toContain('semantic.entities_missing');
    expect(validateSemanticRequirements(cards.document, { ...base, family: 'state-model' }, 'Show an order state machine.').map(({ code }) => code)).toEqual(expect.arrayContaining(['semantic.states_missing', 'semantic.transitions_missing']));
    expect(validateSemanticRequirements(cards.document, { ...base, family: 'requirement-model' }, 'Show requirement verification.').map(({ code }) => code)).toEqual(expect.arrayContaining(['semantic.requirements_missing', 'semantic.traceability_missing']));
  });


  test('uses the stronger model for first drafts and complex replacements', () => {
    expect(shouldUseDraftModel('Make Stripe purple.', 1)).toBe(true);
    expect(shouldUseDraftModel('Make Stripe purple.', 3)).toBe(false);
    expect(shouldUseDraftModel('Create a grouped architecture diagram for the support platform.', 3)).toBe(true);
  });

  test('requires a sufficiently complete plan for detailed grouped prompts', () => {
    const prompt = `Create a system architecture ${'with detailed services and data movement '.repeat(8)}grouped into four areas.`;
    const issues = validateRequirementPlan({ nodes: ['API'], groups: [], groupMemberships: [], peerGroups: false, groupColumns: null, relationships: [] }, prompt);
    expect(issues.map(({ code }) => code)).toEqual([
      'requirements.nodes_incomplete',
      'requirements.relationships_incomplete',
      'requirements.groups_incomplete',
    ]);
  });

  test('recognizes explicit two-column and 2×2 peer-group compositions', () => {
    const requirements = {
      nodes: ['A', 'B', 'C', 'D', 'E'],
      groups: ['One', 'Two'],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: true,
      groupColumns: 2,
      relationships: [
        { from: 'A', to: 'B', kind: 'reporting' },
        { from: 'B', to: 'C', kind: 'reporting' },
        { from: 'C', to: 'D', kind: 'reporting' },
      ],
    };
    expect(validateRequirementPlan(requirements, 'Arrange the sibling frames in a compact 2×2 composition.')).toEqual([]);
    expect(validateRequirementPlan(requirements, 'Use a two-column grid for the sibling frames.')).toEqual([]);
    expect(validateRequirementPlan({ ...requirements, groupColumns: null }, 'Use a 2-column grid for the sibling frames.').map(({ code }) => code)).toContain('requirements.group_columns_incomplete');
  });

  test('requires every relationship endpoint in the node or group contract', () => {
    const issues = validateRequirementPlan({
      nodes: ['API gateway'],
      groups: [],
      groupMemberships: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'Browser', to: 'API gateway', kind: 'reporting' }],
    }, 'Show a browser calling an API gateway.');
    expect(issues).toEqual([{
      code: 'requirements.relationship_endpoint_missing',
      message: 'Relationship endpoint “Browser” must also be listed as a required node or group.',
    }]);
  });

  test('checks nodes, frames, and directed relationships after compilation', () => {
    const result = compileProgram(source);
    expect(result.document).toBeDefined();
    expect(validateSemanticRequirements(result.document, {
      nodes: ['Web app', 'API gateway', 'Order service'],
      groups: ['Client', 'Application'],
      groupMemberships: [],
      peerGroups: true,
      groupColumns: null,
      relationships: [{ from: 'Web app', to: 'API gateway' }, { from: 'API gateway', to: 'Order service' }],
    })).toEqual([]);

    const issues = validateSemanticRequirements(result.document, {
      nodes: ['Vector database'],
      groups: ['AI processing'],
      groupMemberships: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'Order service', to: 'Web app' }],
    });
    expect(issues.map(({ code }) => code)).toEqual([
      'semantic.missing_required_node',
      'semantic.missing_required_group',
      'semantic.missing_required_relationship',
    ]);
    expect(createRequirementRepairPrompt(issues)).toContain('does not yet satisfy');
  });

  test('does not silently accept a relationship with a missing endpoint', () => {
    const result = compileProgram(source);
    const issues = validateSemanticRequirements(result.document, {
      nodes: [],
      groups: [],
      groupMemberships: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'Missing browser', to: 'API gateway' }],
    });
    expect(issues.map(({ code }) => code)).toEqual(['semantic.missing_required_relationship']);
  });

  test('rejects invented grid columns and preserves an explicitly requested flow layout', () => {
    const requirements = {
      nodes: ['Web app', 'API gateway', 'Order service'],
      groups: ['Client', 'Application'],
      groupMemberships: [],
      peerGroups: true,
      groupColumns: 2,
      relationships: [{ from: 'Web app', to: 'API gateway' }],
    };
    expect(validateRequirementPlan(requirements, 'Use flow(..., direction: auto) for the outer composition.').map(({ code }) => code))
      .toContain('requirements.group_columns_invented');

    const result = compileProgram(source);
    expect(validateSemanticRequirements(result.document, { ...requirements, groupColumns: null }, 'Use flow(..., direction: auto) for the outer composition.').map(({ code }) => code))
      .toContain('semantic.required_flow_layout_missing');
  });

  test('enforces restrained color regardless of phrase order', () => {
    const result = compileProgram(`figure colored {
      a = service("A", tone: info)
      b = service("B", tone: success)
      c = service("C", tone: warning)
      row(a, b, c)
    }`);
    const requirements = {
      nodes: ['A', 'B', 'C'],
      groups: [],
      groupMemberships: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [],
    };
    expect(validateSemanticRequirements(result.document, requirements, 'Keep color restrained.').map(({ code }) => code))
      .toContain('semantic.excessive_color');
  });

  test('accepts groups as relationship endpoints and resolves nullable group heads', () => {
    const requirements = {
      nodes: ['President', 'Provost'],
      groups: ['Academic Affairs', 'Operations'],
      groupMemberships: [{ group: 'Academic Affairs', members: ['Provost'] }],
      groupHeads: [{ group: 'Academic Affairs', head: 'Provost' }, { group: 'Operations', head: null }],
      peerGroups: true,
      groupColumns: null,
      relationships: [
        { from: 'President', to: 'Academic Affairs', kind: 'reporting' },
        { from: 'President', to: 'Operations', kind: 'reporting' },
      ],
    };
    expect(validateRequirementPlan(requirements, 'Show university governance with Academic Affairs and Operations.')).toEqual([]);
    const result = compileProgram(`figure governance {
      president = card("President")
      academic = frame("Academic Affairs", layout: column) { provost = card("Provost") }
      operations = frame("Operations", layout: column) { finance = card("Finance") }
      academic_report = connect(president.bottom, academic.provost.top, role: primary)
      operations_report = connect(president.bottom, operations.top, role: primary)
      hierarchy(president, academic, operations, direction: down)
    }`);
    expect(validateSemanticRequirements(result.document, requirements, 'Show a governance hierarchy.')).toEqual([]);
  });

  test('requires advisory semantics and hierarchy layout for governance prompts', () => {
    const result = compileProgram(`figure governance {
      president = card("President")
      senate = card("Faculty Senate")
      advice = connect(senate.right, president.left, variant: directional)
      row(president, senate)
    }`);
    const issues = validateSemanticRequirements(result.document, {
      nodes: ['President', 'Faculty Senate'],
      groups: [],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'Faculty Senate', to: 'President', kind: 'advisory' }],
    }, 'Create a university governance hierarchy.');
    expect(issues.map(({ code }) => code)).toEqual(expect.arrayContaining([
      'semantic.required_hierarchy_layout_missing',
      'semantic.missing_required_relationship',
    ]));
  });

  test('does not accept advisory links as a substitute for a hierarchy reporting tree', () => {
    const requirements = {
      nodes: ['Board of Trustees', 'President', 'Faculty Senate'],
      groups: ['Academic Affairs', 'Operations', 'Student Life'],
      groupMemberships: [],
      groupHeads: [
        { group: 'Academic Affairs', head: null },
        { group: 'Operations', head: null },
        { group: 'Student Life', head: null },
      ],
      peerGroups: true,
      groupColumns: null,
      relationships: [
        { from: 'Faculty Senate', to: 'President', kind: 'advisory' },
      ],
    };
    const codes = validateRequirementPlan(requirements, 'Design a university governance hierarchy with three sibling divisions.').map(({ code }) => code);
    expect(codes).toContain('requirements.reporting_relationships_missing');
    expect(codes).toContain('requirements.peer_group_reporting_parent_missing');
  });

  test('keeps hierarchy entities and groups disjoint', () => {
    const issues = validateRequirementPlan({
      nodes: ['President', 'Academic Affairs'],
      groups: ['Academic Affairs'],
      groupMemberships: [],
      groupHeads: [{ group: 'Academic Affairs', head: null }],
      peerGroups: false,
      groupColumns: null,
      relationships: [{ from: 'President', to: 'Academic Affairs', kind: 'reporting' }],
    }, 'Create a university governance hierarchy.');
    expect(issues.map(({ code }) => code).filter((code) => code === 'requirements.entity_group_overlap'))
      .toEqual(['requirements.entity_group_overlap']);
  });

  test('rejects named governing entities rendered as nested frames', () => {
    const compiled = compileProgram(`figure governance {
      board = frame("Board of Trustees", layout: hierarchy) {
        president = frame("President", layout: hierarchy) {
          academic = frame("Academic Affairs", layout: column) {
            provost = card("Provost")
          }
        }
      }
      senate = card("Faculty Senate")
      advice = connect(senate.right, board.president.left, variant: advisory)
      hierarchy(board, senate, direction: down)
    }`);
    expect(compiled.document).toBeDefined();
    const issues = validateSemanticRequirements(compiled.document, {
      nodes: ['Board of Trustees', 'President', 'Provost', 'Faculty Senate'],
      groups: ['Academic Affairs'],
      groupMemberships: [{ group: 'Academic Affairs', members: ['Provost'] }],
      groupHeads: [{ group: 'Academic Affairs', head: 'Provost' }],
      peerGroups: false,
      groupColumns: null,
      relationships: [
        { from: 'Board of Trustees', to: 'President', kind: 'reporting' },
        { from: 'Faculty Senate', to: 'President', kind: 'advisory' },
      ],
    }, 'Design a university governance hierarchy.');
    expect(issues.filter(({ code }) => code === 'semantic.required_node_rendered_as_group').map(({ message }) => message))
      .toEqual(expect.arrayContaining([
        'Required entity “Board of Trustees” must be a card/component, not a frame used to encode reporting.',
        'Required entity “President” must be a card/component, not a frame used to encode reporting.',
      ]));
  });

  test('accepts supporting payment and storage relationships without treating them as advisory', () => {
    const result = compileProgram(`figure checkout {
      api = service("Checkout API")
      stripe = service("Stripe")
      postgres = database("Postgres")
      payment = connect(api.bottom, stripe.top, role: supporting)
      storage = connect(api.bottom, postgres.top, role: supporting)
      flow(api, stripe, postgres, direction: auto)
    }`);
    const requirements = {
      nodes: ['Checkout API', 'Stripe', 'Postgres'],
      groups: [],
      groupMemberships: [],
      groupHeads: [],
      peerGroups: false,
      groupColumns: null,
      relationships: [
        { from: 'Checkout API', to: 'Stripe', kind: 'supporting' },
        { from: 'Checkout API', to: 'Postgres', kind: 'supporting' },
      ],
    };
    expect(validateSemanticRequirements(result.document, requirements, 'Show supporting payment and storage relationships.')).toEqual([]);
  });

  test('models nested groups as containment without impossible frame-to-member reporting edges', () => {
    const requirements = {
      nodes: ['President', 'Provost', 'Biology'],
      groups: ['Academic Affairs', 'Science'],
      groupMemberships: [
        { group: 'Academic Affairs', members: ['Provost', 'Science'] },
        { group: 'Science', members: ['Biology'] },
      ],
      groupHeads: [{ group: 'Academic Affairs', head: 'Provost' }, { group: 'Science', head: null }],
      peerGroups: true,
      groupColumns: null,
      relationships: [
        { from: 'President', to: 'Academic Affairs', kind: 'reporting' },
        { from: 'Provost', to: 'Science', kind: 'reporting' },
      ],
    };
    expect(validateRequirementPlan(requirements, 'Show a governance hierarchy grouped into Academic Affairs with a nested Science school.')).toEqual([]);
    const compiled = compileProgram(`figure governance {
      president = card("President")
      academic = frame("Academic Affairs", layout: hierarchy) {
        provost = card("Provost")
        science = frame("Science", layout: column) { biology = card("Biology") }
      }
      president_academic = connect(president.bottom, academic.top, role: primary)
      provost_science = connect(academic.provost.bottom, academic.science.top, role: primary)
      hierarchy(president, academic, direction: down)
    }`);
    expect(validateSemanticRequirements(compiled.document, requirements, 'Show a governance hierarchy.')).toEqual([]);

    const invalid = structuredClone(requirements);
    invalid.relationships.push({ from: 'Science', to: 'Biology', kind: 'reporting' });
    expect(validateRequirementPlan(invalid, 'Show a governance hierarchy.').map(({ code }) => code))
      .toContain('requirements.frame_descendant_relationship_invalid');
  });

  test('keeps hierarchy syntax invariant across compiler and semantic repairs', () => {
    const compilerRepair = createStudioCompilerRepairPrompt('Repair this source.', 'Create a university governance hierarchy.');
    const semanticRepair = createRequirementRepairPrompt([
      { code: 'semantic.required_hierarchy_layout_missing', message: 'Hierarchy is required.' },
    ], 'Create a university governance hierarchy.');
    for (const repair of [compilerRepair, semanticRepair]) {
      expect(repair).toContain('exactly one root layout');
      expect(repair).toContain('must be hierarchy(..., direction: down)');
      expect(repair).toContain('never components or assigned bindings');
      expect(repair).toContain('fully qualified ID');
    }
  });
});
