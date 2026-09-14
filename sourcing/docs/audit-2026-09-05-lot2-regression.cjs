const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const workflow = file => JSON.parse(fs.readFileSync(path.join(root, 'n8n', file), 'utf8'));
const p2 = workflow('Dropship phase 2 v2 AliExpress.json');
const p3 = workflow('Dropship phase 3 v2 AI Evaluation.json');
const p4 = workflow('Dropship phase 4 v2 Competition Analysis.json');
const node = (value, name) => value.nodes.find(item => item.name === name);

function run(value, name, inputs, upstream = {}) {
  const context = {
    $execution: {id: 'lot2-regression'},
    $input: {all: () => inputs, first: () => inputs[0]},
    $: key => ({
      all: () => upstream[key] || [],
      first: () => (upstream[key] || [])[0],
      itemMatching: index => (upstream[key] || [])[index],
    }),
  };
  return vm.runInNewContext(
    '(function(){' + node(value, name).parameters.jsCode + '\n})()',
    context,
    {timeout: 1000},
  );
}

const terminal = run(p2, 'Select all pending accepted opportunities', [
  {json: {status: 'PHASE2_NO_MATCH', product_name: 'A', search_query: 'a'}},
]);
assert.equal(terminal.length, 0);

const future = new Date(Date.now() + 3600000).toISOString();
const delayed = run(p2, 'Select all pending accepted opportunities', [
  {json: {status: 'PHASE2_RETRY', prompt_version: 'opportunity-gate-v4', product_name: 'A', search_query: 'a', phase2_next_retry_at: future}},
]);
assert.equal(delayed.length, 0);

const resumed = run(p2, 'Select all pending accepted opportunities', [
  {json: {
    status: 'PHASE2_RETRY', prompt_version: 'opportunity-gate-v4', product_name: 'A', search_query: 'a',
    opportunity_id: 'reddit:a', phase2_remaining_product_ids: '["1005000000001"]',
  }},
]);
assert.deepEqual(Array.from(resumed[0].json.resume_product_ids), ['1005000000001']);

const joined = run(p3, 'Join evidence and select up to 50 products', [
  {json: {product_name: 'Need A', search_query: 'mop', opportunity_id: 'reddit:a'}},
  {json: {product_name: 'Need B', search_query: 'mop', opportunity_id: 'reddit:b'}},
  {json: {'product name': 'Need A', link: 'https://www.aliexpress.com/item/1005000000001.html', status: 'RESEARCHED', opportunity_id: 'reddit:a', product_id: '1005000000001', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000001|FR'}},
  {json: {'product name': 'Need B', link: 'https://www.aliexpress.com/item/1005000000001.html', status: 'RESEARCHED', opportunity_id: 'reddit:b', product_id: '1005000000001', destination_country: 'FR', evaluation_key: 'reddit:b|1005000000001|FR'}},
]);
assert.equal(joined.length, 2);
assert.equal(new Set(joined.map(item => item.json.evaluation_key)).size, 2);

const phase4 = run(p4, 'Join eligible products to search queries', [
  {json: {recommendation: 'HOLD', product_name: 'Product [1005000000001]', product_id: '1005000000001', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000001|FR'}},
  {json: {recommendation: 'HOLD', product_name: 'Product [1005000000001]', product_id: '1005000000001', opportunity_id: 'reddit:b', destination_country: 'FR', evaluation_key: 'reddit:b|1005000000001|FR'}},
  {json: {'product name': 'Need A', 'search query': 'mop a', title: 'Product', price: '10 EUR', link: 'https://www.aliexpress.com/item/1005000000001.html', product_id: '1005000000001', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000001|FR'}},
  {json: {'product name': 'Need B', 'search query': 'mop b', title: 'Product', price: '10 EUR', link: 'https://www.aliexpress.com/item/1005000000001.html', product_id: '1005000000001', opportunity_id: 'reddit:b', destination_country: 'FR', evaluation_key: 'reddit:b|1005000000001|FR'}},
]);
assert.equal(phase4.length, 2);
assert.equal(new Set(phase4.map(item => item.json.group_key)).size, 2);

const groupedPhase4 = run(p4, 'Join eligible products to search queries', [
  {json: {recommendation: 'HOLD', product_name: 'A1 [1005000000001]', product_id: '1005000000001', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000001|FR', final_score: 70}},
  {json: {recommendation: 'SHORTLIST', product_name: 'A2 [1005000000002]', product_id: '1005000000002', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000002|FR', final_score: 80}},
  {json: {recommendation: 'HOLD', product_name: 'B1 [1005000000003]', product_id: '1005000000003', opportunity_id: 'reddit:b', destination_country: 'FR', evaluation_key: 'reddit:b|1005000000003|FR', final_score: 65}},
  {json: {'product name': 'Need A', 'search query': 'dog hair mop', title: 'A1', price: '10 EUR', link: 'https://www.aliexpress.com/item/1005000000001.html', product_id: '1005000000001', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000001|FR'}},
  {json: {'product name': 'Need A', 'search query': 'dog hair mop', title: 'A2', price: '12 EUR', link: 'https://www.aliexpress.com/item/1005000000002.html', product_id: '1005000000002', opportunity_id: 'reddit:a', destination_country: 'FR', evaluation_key: 'reddit:a|1005000000002|FR'}},
  {json: {'product name': 'Need B', 'search query': 'fridge organizer', title: 'B1', price: '15 EUR', link: 'https://www.aliexpress.com/item/1005000000003.html', product_id: '1005000000003', opportunity_id: 'reddit:b', destination_country: 'FR', evaluation_key: 'reddit:b|1005000000003|FR'}},
]);
assert.equal(groupedPhase4.length, 2);
assert.deepEqual(Array.from(groupedPhase4, item => item.json.targets.length).sort(), [1, 2]);
const expandedPhase4 = run(
  p4,
  'Expand competition to grouped products',
  groupedPhase4.map((group, index) => ({json: {competition_level: 'LOW', status: 'PHASE4_COMPETITION_MEASURED', search_run_id: index + 1}})),
  {'Build comparability payloads': groupedPhase4.map(item => ({json: {...item.json, opportunity: {opportunity_id: item.json.opportunity_id, destination_country: item.json.destination_country, source_problem: item.json.source_problem}}}))},
);
assert.equal(expandedPhase4.length, 3);
assert.equal(new Set(expandedPhase4.map(item => item.json.evaluation_key)).size, 3);
assert.ok(expandedPhase4.every(item => item.json.prompt_version === 'competition-comparability-v3'));

const phase4Usage = status => run(
  p4,
  'Record Phase 4 actual-or-estimated usage',
  [{json: {
    status, search_run_id: 42, prompt_version: 'competition-comparability-v3',
    raw_response_chars: 200, sample_size: 12,
  }}],
  {
    'Build comparability payloads': [{json: {target: {}, candidates: []}}],
  },
)[0].json.status;
assert.equal(phase4Usage('PHASE4_COMPETITION_MEASURED'), 'SUCCESS');
assert.equal(phase4Usage('PHASE4_RETRY'), 'RETRY');

const competitionCandidates = Array.from({length: 9}, (_, index) => ({
  product_id: String(1005000000100 + index),
  title: `Candidate ${index}`,
  price: 10 + index,
  currency: 'EUR',
  store_id: `store-${index}`,
}));
const classifications = competitionCandidates.map((candidate, index) => ({
  product_id: candidate.product_id,
  class: index < 7 ? 'direct' : 'adjacent',
  confidence: 80,
  reason: 'test classification',
}));
const measuredCompetition = run(
  p4,
  'Calculate measured competition',
  [{json: {text: JSON.stringify({prompt_version: 'competition-comparability-v2', results: classifications})}}],
  {'Build comparability payloads': [{json: {
    target: {product_id: '1005000000001', title: 'Target', currency: 'EUR'},
    candidates: competitionCandidates,
    search_run_id: 43,
  }}]},
)[0].json;
assert.equal(measuredCompetition.status, 'PHASE4_COMPETITION_MEASURED');
assert.equal(measuredCompetition.competition_level, 'HIGH');
const phase4Prompt = node(p4, 'AI - Classify direct competitors only').parameters.messages.messageValues[0].message;
assert.match(phase4Prompt, /confidence\\?":80/);
assert.match(phase4Prompt, /50 to 100/);

for (const value of [p2, p3, p4]) {
  assert.ok(node(value, 'Check AliExpress API health'));
  const urls = value.nodes.filter(item => item.type === 'n8n-nodes-base.httpRequest').map(item => item.parameters.url || '');
  assert.ok(urls.some(url => String(url).includes('ALIEXPRESS_API_BASE')));
}

console.log(JSON.stringify({scope: 'Lot 2 exported-workflow regression checks', passed: 12}, null, 2));
