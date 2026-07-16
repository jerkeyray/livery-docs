import { describe, expect, test } from 'bun:test';
import { compileProgram } from '@jerkeyray/core';
import {
  createRequirementRepairPrompt,
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
    const issues = validateRequirementPlan({ nodes: ['API'], groups: [], relationships: [] }, prompt);
    expect(issues.map(({ code }) => code)).toEqual([
      'requirements.nodes_incomplete',
      'requirements.relationships_incomplete',
      'requirements.groups_incomplete',
    ]);
  });

  test('requires every relationship endpoint in the node contract', () => {
    const issues = validateRequirementPlan({
      nodes: ['API gateway'],
      groups: [],
      relationships: [{ from: 'Browser', to: 'API gateway' }],
    }, 'Show a browser calling an API gateway.');
    expect(issues).toEqual([{
      code: 'requirements.relationship_endpoint_missing',
      message: 'Relationship endpoint “Browser” must also be listed as a required node.',
    }]);
  });

  test('checks nodes, frames, and directed relationships after compilation', () => {
    const result = compileProgram(source);
    expect(result.document).toBeDefined();
    expect(validateSemanticRequirements(result.document, {
      nodes: ['Web app', 'API gateway', 'Order service'],
      groups: ['Client', 'Application'],
      relationships: [{ from: 'Web app', to: 'API gateway' }, { from: 'API gateway', to: 'Order service' }],
    })).toEqual([]);

    const issues = validateSemanticRequirements(result.document, {
      nodes: ['Vector database'],
      groups: ['AI processing'],
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
      relationships: [{ from: 'Missing browser', to: 'API gateway' }],
    });
    expect(issues.map(({ code }) => code)).toEqual(['semantic.missing_required_relationship']);
  });
});
