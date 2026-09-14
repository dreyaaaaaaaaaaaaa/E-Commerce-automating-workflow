const assert = require('assert');
const fs = require('fs');

const files = [
  ['n8n/Dropship phase 1 v2 Reddit.json', 'Run Phase 1 from orchestrator'],
  ['n8n/Dropship phase 2 v2 AliExpress.json', 'Run Phase 2 from orchestrator'],
  ['n8n/Dropship phase 3 v2 AI Evaluation.json', 'Run Phase 3 from orchestrator'],
  ['n8n/Dropship phase 4 v2 Competition Analysis.json', 'Run Phase 4 from orchestrator'],
  ['n8n/Dropship phase 5 v1 Product Validation.json', 'Run Phase 5 from orchestrator'],
];

for (const [file, triggerName] of files) {
  const workflow = JSON.parse(fs.readFileSync(file, 'utf8'));
  const trigger = workflow.nodes.find(node => node.name === triggerName);
  assert(trigger, `Missing orchestrator trigger in ${file}`);
  assert.strictEqual(trigger.type, 'n8n-nodes-base.executeWorkflowTrigger');
  assert.strictEqual(trigger.parameters.inputSource, 'passthrough');
  assert(workflow.connections[triggerName]?.main?.[0]?.length, `Unconnected trigger in ${file}`);
}

const master = JSON.parse(
  fs.readFileSync('n8n/Dropship end-to-end orchestrator v1.json', 'utf8')
);
const phaseNodes = master.nodes.filter(node => node.type === 'n8n-nodes-base.executeWorkflow');
assert.strictEqual(phaseNodes.length, 5);
for (const node of phaseNodes) {
  assert.strictEqual(node.parameters.mode, 'all');
  assert.strictEqual(node.parameters.options.waitForSubWorkflow, true);
  assert.strictEqual(node.alwaysOutputData, true);
}
assert(master.nodes.some(node => node.name === 'Complete end-to-end run'));

console.log(JSON.stringify({scope: 'End-to-end orchestration', passed: 5}, null, 2));
