// Non-regression checks for the eight n8n defects reproduced by the Astra audit.
// No network calls or business-data writes.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const workflow = file => JSON.parse(
  fs.readFileSync(path.join(root, 'n8n', file), 'utf8').replace(/^\uFEFF/, '')
);
const p1 = workflow('Dropship phase 1 v2 Reddit.json');
const p2 = workflow('Dropship phase 2 v2 AliExpress.json');
const p3 = workflow('Dropship phase 3 v2 AI Evaluation.json');
const p4 = workflow('Dropship phase 4 v2 Competition Analysis.json');
const node = (workflowValue, name) => {
  const found = workflowValue.nodes.find(item => item.name === name);
  if (!found) throw new Error('Missing node: ' + name);
  return found;
};

function run(workflowValue, name, inputs, upstream = {}) {
  const context = {
    $execution: {id: 'regression'},
    $input: {all: () => inputs, first: () => inputs[0]},
    $: key => {
      if (!(key in upstream)) throw new Error('Missing fixture: ' + key);
      return {
        all: () => upstream[key],
        item: upstream[key][0],
        first: () => upstream[key][0],
        itemMatching: index => upstream[key][index],
      };
    },
  };
  return vm.runInNewContext(
    '(function(){' + node(workflowValue, name).parameters.jsCode + '\n})()',
    context,
    {timeout: 1000}
  );
}

const passed = [];

const emittedStatus = node(p1, 'Append accepted opportunity').parameters.columns.value.status;
assert.equal(emittedStatus, 'PHASE1_QUALIFIED');
const selected = run(
  p2,
  'Select all pending accepted opportunities',
  [{json: {status: emittedStatus, prompt_version: 'opportunity-gate-v4', product_name: 'Mug', search_query: 'ceramic mug'}}]
);
assert.equal(selected.length, 1);
const historical = run(
  p2,
  'Select all pending accepted opportunities',
  [
    {json: {status: 'PHASE1_ACCEPTED', prompt_version: 'opportunity-gate-v3', product_name: 'Old', search_query: 'old product'}},
    {json: {status: 'MEGA_TEST_ACCEPT', product_name: 'Old test', search_query: 'old test product'}},
  ]
);
assert.equal(historical.length, 0);
passed.push('A01');

const rank = run(
  p2,
  'Rank candidates deterministically',
  [{json: {status: 'ok', search: {results: [
    {product_id: '1005000000001', title: 'Automotive replacement tire', min_price: 10},
  ]}}}],
  {'Select all pending accepted opportunities': [
    {json: {product_name: 'Mug', search_query: 'ceramic mug'}},
  ]}
);
assert.equal(rank[0].json.candidates.length, 0);
passed.push('A02');

const product = {
  product_id: '1005000000001',
  source_problem: 'Mug',
  title: 'Mug',
  url: 'https://example.test/item',
  eligible_variant_count: 1,
};
const invalidEvaluation = run(
  p3,
  'Validate every Phase 3 result',
  [{json: {text: JSON.stringify({results: [
    {product_id: product.product_id, verdict: 'shortlist'},
  ]})}}],
  {'Build evidence batches of 5': [
    {json: {batch_id: 1, products: [product]}},
  ]}
);
assert.equal(invalidEvaluation[0].json.verdict, 'hold');
assert.equal(invalidEvaluation[0].json.reason_code, 'AI_FORMAT_ERROR');
assert.match(invalidEvaluation[0].json.format_error, /Invalid problem_solution_fit/);
passed.push('A03');

const retryJoin = run(
  p3,
  'Join evidence and select up to 50 products',
  [
    {json: {product_name: 'Mug', search_query: 'ceramic mug'}},
    {json: {
      'product name': 'Mug',
      link: 'https://www.aliexpress.com/item/1005000000001.html',
      status: 'PHASE3_RETRY',
    }},
  ]
);
assert.equal(retryJoin.length, 1);
passed.push('A04');

function competition(candidates, confidence = 90) {
  const payload = {
    target: {...product, currency: 'EUR'},
    candidates,
    search_query: 'mug',
    search_status: 'ok',
  };
  const text = JSON.stringify({results: candidates.map(candidate => ({
    product_id: candidate.product_id,
    class: 'direct',
    confidence,
  }))});
  return run(
    p4,
    'Calculate measured competition',
    [{json: {text}}],
    {'Build comparability payloads': [{json: payload}]}
  )[0].json;
}

const candidates = Array.from({length: 15}, (_, index) => ({
  product_id: String(1005000000000 + index),
  price: null,
  currency: 'EUR',
  orders_count: null,
}));
const nullMetrics = competition(candidates);
assert.equal(nullMetrics.median_price, null);
assert.equal(nullMetrics.price_currency, null);
assert.equal(nullMetrics.order_data_count, 0);
passed.push('A05');

const lowConfidence = competition(candidates, 10);
assert.equal(lowConfidence.competition_level, 'INSUFFICIENT_DATA');
assert.equal(lowConfidence.usable_classification_coverage, 0);
passed.push('A06');

const currencies = competition(candidates.map((candidate, index) => ({
  ...candidate,
  price: index < 8 ? 10 : 100,
  currency: index < 8 ? 'USD' : 'PLN',
})));
assert.equal(currencies.price_currency, null);
assert.equal(currencies.median_price, null);
passed.push('A07');

const batchResponses = [
  {json: {text: JSON.stringify({results: [{source_id: 'a', decision: 'reject'}]})}},
  {json: {text: JSON.stringify({results: [{source_id: 'b', decision: 'reject'}]})}},
];
const batches = [
  {json: {candidates: [{source_id: 'a'}]}},
  {json: {candidates: [{source_id: 'b'}]}},
];
const validation = run(
  p1,
  'Validate AI JSON',
  batchResponses,
  {'Build AI batches of 5': batches}
);
const usage = run(
  p1,
  'Estimate AI token usage',
  batchResponses,
  {'Build AI batches of 5': batches}
);
assert.equal(validation.length, 2);
assert.equal(usage.length, 2);
assert.deepEqual(
  Array.from(validation, item => item.json.source_id),
  ['a', 'b']
);
passed.push('A08');

console.log(JSON.stringify({
  scope: 'Exported n8n Code-node regression checks; no live n8n run.',
  passed: passed.length,
  findings: passed,
}, null, 2));
