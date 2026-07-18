import { describe, expect, test } from 'bun:test';
import { compileProgram } from '@jerkeyray/core';
import {
  createRequirementRepairPrompt,
  createStudioCompilerRepairPrompt,
  shouldUseDraftModel,
  validateRequirementPlan,
  validateSemanticRequirements,
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
