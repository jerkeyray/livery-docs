export type StudioStarterPrompt = {
  title: string;
  description: string;
  prompt: string;
};

export const studioStarterPrompts = [
  {
    title: 'Production checkout',
    description: 'A proven six-node purchase path',
    prompt: [
      'Create a compact landscape production-checkout architecture that fits a 900px-wide 16:9 canvas.',
      'Use exactly six top-level nodes and no frames: Browser; Checkout API; Stripe; Postgres; Queue; and Fulfillment Worker.',
      'Use the native flow layout with direction right. Make Browser → Checkout API → Queue → Fulfillment Worker the clear primary reading spine.',
      'Place Stripe and Postgres below Checkout API as a compact side-effect branch. Connect Checkout API → Stripe and Checkout API → Postgres with role supporting.',
      'Use only these connector labels: checkout, publish, dispatch, authorize, and write order.',
      'Do not add customer, order, database, event, response, or return nodes. Do not draw duplicate or outer canvas return connectors.',
      'Keep all connectors local, orthogonal, and crossing-free. Keep most nodes muted, use one blue focal treatment for Checkout API, and a restrained green treatment for Fulfillment Worker.',
    ].join(' '),
  },
  {
    title: 'Research agent',
    description: 'A clean spine with one compact tool branch',
    prompt: [
      'Create a compact landscape AI-research workflow that fits a 900px-wide 16:9 canvas.',
      'Use exactly five top-level nodes and no frames. Make four aligned card components for the primary spine: User with subtitle “Research request”; Research Agent with subtitle “Plans and reasons”; Evidence with subtitle “Accepted findings”; and Cited Answer with subtitle “Evidence checked”.',
      'Represent the tools as one list component titled Research Tools with exactly two items: Web Search and Document Retrieval. Do not create separate tool nodes.',
      'Use the native flow layout with direction right. Connect User.right → Research Agent.left, Research Agent.right → Evidence.left, and Evidence.right → Cited Answer.left as the primary reading spine so all three connectors are straight and horizontal.',
      'Place Research Tools once below the gap between Research Agent and Evidence. Draw one supporting connector from Research Agent.bottom to Research Tools.top and one supporting connector from Research Tools.right to Evidence.bottom.',
      'Use only these connector labels: request, synthesize, answer, research, and findings.',
      'Do not add Planner, Reasoning Model, Working Memory, Evaluator, feedback, revise, answer-to-user, duplicate, or outer canvas return connectors.',
      'Keep most cards muted, use one blue focal treatment for Research Agent, green for Evidence, and a restrained solid treatment for Cited Answer.',
    ].join(' '),
  },
  {
    title: 'Realtime data platform',
    description: 'A truthful folded streaming path',
    prompt: [
      'Create a compact landscape realtime-analytics platform that fits a 900px-wide 16:9 canvas.',
      'Use exactly six top-level nodes and no frames: Product Events; Event API; Kafka; Stream Processor; Warehouse; and Live Dashboard.',
      'The primary reading spine and data path must be Product Events → Event API → Kafka → Stream Processor → Warehouse → Live Dashboard. Every connector in that path is role primary; do not bypass Kafka or Warehouse.',
      'Use a three-column grid with a folded serpentine reading order: Product Events, Event API, and Kafka across the top row; Live Dashboard, Warehouse, and Stream Processor across the bottom row.',
      'Use only these connector labels in order: ingest, publish, stream, store, and query.',
      'Do not add a metrics model, second dashboard, return path, duplicate edge, frame, or outer canvas connector.',
      'Keep connectors local, orthogonal, and crossing-free. Keep most nodes muted, use blue only for Stream Processor and a restrained storage treatment for Warehouse.',
    ].join(' '),
  },
  {
    title: 'Safe deployment',
    description: 'A proven six-node release decision',
    prompt: [
      'Create a compact landscape safe-deployment workflow that fits a 900px-wide 16:9 canvas.',
      'Use exactly six top-level nodes and no frames: Commit; CI Tests; Canary; Health Check; Production; and Rollback.',
      'Use the native flow layout with direction right. Make Commit → CI Tests → Canary → Health Check the primary reading spine.',
      'Place Production and Rollback immediately to the right of Health Check as a compact decision split. Connect Health Check → Production with role secondary and Health Check → Rollback with role secondary.',
      'Use gap $space.xs and rankGap $space.xs. Leave the primary spine unlabeled; use only pass and fail on the two decision connectors.',
      'Do not add artifact, staging, developer, monitoring, retry, feedback, duplicate, frame, or outer canvas return nodes and connectors.',
      'Keep connectors local, orthogonal, and crossing-free. Keep ordinary stages muted and reserve warning, success, and danger tones for Canary, Production, and Rollback.',
    ].join(' '),
  },
] as const satisfies ReadonlyArray<StudioStarterPrompt>;
