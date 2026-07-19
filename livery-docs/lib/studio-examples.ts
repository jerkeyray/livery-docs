export type StudioExample = {
  id: string;
  family: 'Architecture' | 'Workflow' | 'Data' | 'Hierarchy' | 'Sequence';
  title: string;
  description: string;
  source: string;
};

export const studioExamples = [
  {
    id: 'production-checkout',
    family: 'Architecture',
    title: 'Production checkout',
    description: 'Synchronous purchase path with durable fulfillment.',
    source: `figure production_checkout("Production checkout") {
  browser = browser("Browser", variant: muted)
  api = api("Checkout API", subtitle: "Validates the cart", variant: soft, tone: info)
  payment = service("Payment", variant: muted)
  orders = database("Orders DB", variant: muted)
  queue = queue("Orders", variant: soft, tone: info)
  worker = worker("Fulfillment", variant: soft, tone: success)

  checkout = connect(browser.right, api.left, label: "checkout", role: primary)
  authorize = connect(api.right, payment.left, label: "authorize", role: primary)
  persist = connect(payment.right, orders.left, label: "persist", role: primary)
  publish = connect(orders.right, queue.left, label: "publish", role: primary)
  dispatch = connect(queue.right, worker.left, label: "dispatch", role: primary)

  flow(browser, api, payment, orders, queue, worker, direction: auto, gap: $space.xs, rankGap: $space.md)
}`,
  },
  {
    id: 'ai-research',
    family: 'Workflow',
    title: 'AI research workflow',
    description: 'A clean reasoning spine from request to cited answer.',
    source: `figure ai_research("AI research") {
  user = person("User", subtitle: "Research request", variant: muted)
  agent = agent("Research Agent", subtitle: "Plans and reasons", variant: soft, tone: info)
  evidence = note("Evidence", subtitle: "Accepted findings", variant: soft, tone: success)
  answer = card("Cited Answer", subtitle: "Evidence checked", variant: solid)

  request = connect(user.right, agent.left, label: "request", role: primary)
  synthesize = connect(agent.right, evidence.left, label: "synthesize", role: primary)
  response = connect(evidence.right, answer.left, label: "answer", role: primary)
  flow(user, agent, evidence, answer, direction: auto, gap: $space.xs, rankGap: $space.md)
}`,
  },
  {
    id: 'realtime-analytics',
    family: 'Data',
    title: 'Realtime analytics',
    description: 'An event stream from product activity to a live view.',
    source: `figure realtime_analytics("Realtime analytics") {
  events = event("Product Events", variant: muted)
  api = api("Event API", variant: muted)
  kafka = queue("Kafka", variant: muted)
  processor = worker("Stream Processor", subtitle: "Enriches events", variant: soft, tone: info)
  warehouse = database("Warehouse", variant: muted)
  dashboard = browser("Live Dashboard", variant: soft, tone: success)

  ingest = connect(events.right, api.left, label: "ingest", role: primary)
  publish = connect(api.right, kafka.left, label: "publish", role: primary)
  stream = connect(kafka.right, processor.left, label: "stream", role: primary)
  store = connect(processor.right, warehouse.left, label: "store", role: primary)
  query = connect(warehouse.right, dashboard.left, label: "query", role: primary)

  flow(events, api, kafka, processor, warehouse, dashboard, direction: auto, gap: $space.xs, rankGap: $space.md)
}`,
  },
  {
    id: 'safe-deployment',
    family: 'Workflow',
    title: 'Safe deployment',
    description: 'A canary release with explicit pass and rollback outcomes.',
    source: `figure safe_deployment("Safe deployment") {
  commit = card("Commit", variant: muted)
  tests = service("CI Tests", variant: muted)
  canary = service("Canary", variant: soft, tone: warning)
  health = card("Health Check", variant: muted)
  production = service("Production", variant: soft, tone: success)
  rollback = service("Rollback", variant: soft, tone: danger)

  connect(commit.right, tests.left, role: primary)
  connect(tests.right, canary.left, role: primary)
  connect(canary.right, health.left, role: primary)
  connect(health.right, production.left, label: "pass", role: secondary)
  connect(health.bottom, rollback.left, label: "fail", role: secondary)

  flow(commit, tests, canary, health, production, rollback, direction: auto, gap: $space.xs, rankGap: $space.xs)
}`,
  },
  {
    id: 'b-tree',
    family: 'Hierarchy',
    title: 'B-tree',
    description: 'A structurally correct balanced search tree.',
    source: `figure b_tree("B-tree") {
  rootNode = card("[20 | 40]", subtitle: "separator keys", variant: soft, tone: info)
  left = card("[10]", subtitle: "internal")
  middle = card("[30]", subtitle: "internal")
  right = card("[50 | 60]", subtitle: "internal")
  l1 = card("[5 | 8]", subtitle: "leaf · same depth", variant: muted)
  m1 = card("[22 | 28]", subtitle: "leaf · same depth", variant: muted)
  r1 = card("[45 | 48]", subtitle: "leaf · same depth", variant: muted)

  connect(rootNode.bottom, left.top, role: primary)
  connect(rootNode.bottom, middle.top, role: primary)
  connect(rootNode.bottom, right.top, role: primary)
  connect(left.bottom, l1.top, role: primary)
  connect(middle.bottom, m1.top, role: primary)
  connect(right.bottom, r1.top, role: primary)

  hierarchy(rootNode, left, middle, right, l1, m1, r1, direction: down, gap: $space.xs, rankGap: $space.md)
}`,
  },
  {
    id: 'checkout-sequence',
    family: 'Sequence',
    title: 'Checkout request',
    description: 'Ordered request and response messages across services.',
    source: `figure checkout_sequence("Checkout request") {
  customer = participant("Customer")
  api = participant("Checkout API")
  payment = participant("Payment")
  orders = participant("Orders DB")

  connect(customer.right, api.left, label: "checkout", semantic: message, messageKind: sync, order: 0)
  connect(api.right, payment.left, label: "authorize", semantic: message, messageKind: sync, order: 1)
  connect(api.right, orders.left, label: "persist", semantic: message, messageKind: async, order: 2)
  connect(api.left, customer.right, label: "confirmed", semantic: message, messageKind: return, order: 3)

  interaction(customer, api, payment, orders)
}`,
  },
  {
    id: 'orders-schema',
    family: 'Data',
    title: 'Orders schema',
    description: 'Typed entities with explicit cardinality.',
    source: `figure orders_schema("Orders schema") {
  customer = entity("Customer", fields: [{ name: "id", type: "uuid", key: true }, { name: "email", type: "string" }])
  order = entity("Order", fields: [{ name: "id", type: "uuid", key: true }, { name: "status", type: "string" }])
  item = entity("Order Item", fields: [{ name: "order_id", type: "uuid", key: true }, { name: "sku", type: "string" }, { name: "quantity", type: "integer" }])

  places = connect(customer.right, order.left, label: "places", semantic: association, fromCardinality: "1", toCardinality: "0..*")
  contains = connect(order.right, item.left, label: "contains", semantic: composition, fromCardinality: "1", toCardinality: "1..*")
  flow(customer, order, item, direction: auto, gap: $space.xs, rankGap: $space.md)
}`,
  },
] as const satisfies ReadonlyArray<StudioExample>;
