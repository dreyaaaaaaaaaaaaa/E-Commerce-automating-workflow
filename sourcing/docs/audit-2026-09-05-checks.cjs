// Reproductions locales des constats d'audit. Aucun appel réseau ni écriture métier.
// Exécuter depuis la racine : node docs/audit-2026-09-05-checks.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const workflow = file => JSON.parse(fs.readFileSync(path.join(root, 'n8n', file), 'utf8').replace(/^\uFEFF/, ''));
const p1 = workflow('Dropship phase 1 v2 Reddit.json');
const p2 = workflow('Dropship phase 2 v2 AliExpress.json');
const p3 = workflow('Dropship phase 3 v2 AI Evaluation.json');
const p4 = workflow('Dropship phase 4 v2 Competition Analysis.json');
const node = (w, name) => w.nodes.find(n => n.name === name);
function run(w, name, inputs, upstream = {}) {
  const context = {
    $input: { all: () => inputs, first: () => inputs[0] },
    $: key => {
      if (!(key in upstream)) throw new Error('Missing fixture: ' + key);
      return { all: () => upstream[key], item: upstream[key][0], itemMatching: i => upstream[key][i] };
    },
  };
  return vm.runInNewContext('(function(){' + node(w, name).parameters.jsCode + '\n})()', context, {timeout: 1000});
}
const findings = [];
const emittedStatus = node(p1, 'Append accepted opportunity').parameters.columns.value.status;
const selected = run(p2, 'Select all pending accepted opportunities', [{json: {status: emittedStatus, product_name: 'Mug', search_query: 'ceramic mug'}}]);
assert.equal(selected.length, 0);
findings.push({id: 'A01', observed: 'Phase 1 emits ' + emittedStatus + '; Phase 2 selects zero rows.'});
const rank = run(p2, 'Rank candidates deterministically', [{json: {status: 'ok', search: {results: [{product_id: '1005000000001', title: 'Automotive replacement tire', min_price: 10}]}}}], {'Select all pending accepted opportunities': [{json: {product_name: 'Mug', search_query: 'ceramic mug'}}]});
assert.equal(rank[0].json.candidates.length, 1);
assert.equal(rank[0].json.candidates[0].query_overlap, 0);
findings.push({id: 'A02', observed: 'A candidate with zero query overlap is sent to detail collection.'});
const product = {product_id: '1005000000001', source_problem: 'Mug', title: 'Mug', url: 'https://example.test/item'};
const evaluation = run(p3, 'Validate every Phase 3 result', [{json: {text: JSON.stringify({results: [{product_id: product.product_id, verdict: 'shortlist'}]})}}], {'Build evidence batches of 5': [{json: {batch_id: 1, products: [product]}}]});
assert.equal(evaluation[0].json.verdict, 'shortlist');
findings.push({id: 'A03', observed: 'SHORTLIST passes with every mandatory numerical score omitted.'});
const filters = node(p3, 'Get products awaiting Phase 3').parameters.filtersUI.values;
assert.equal(filters.length, 1);
assert.equal(filters[0].lookupValue, 'RESEARCHED');
findings.push({id: 'A04', observed: 'PHASE3_RETRY is not selected by the Phase 3 input filter.'});
function competition(candidates, confidence = 90) {
  const payload = {target: {...product, currency: 'EUR'}, candidates, search_query: 'mug', search_status: 'ok'};
  const text = JSON.stringify({results: candidates.map(c => ({product_id: c.product_id, class: 'direct', confidence}))});
  return run(p4, 'Calculate measured competition', [{json: {text}}], {'Build comparability payloads': [{json: payload}]})[0].json;
}
const candidates = Array.from({length: 15}, (_, i) => ({product_id: String(1005000000000 + i), price: null, currency: 'EUR', orders_count: null}));
const nullMetrics = competition(candidates);
assert.equal(nullMetrics.median_price, 0);
assert.equal(nullMetrics.order_data_count, 15);
findings.push({id: 'A05', observed: '15 absent prices/orders become a zero median and 15 observed order records.'});
const lowConfidence = competition(candidates, 10);
assert.equal(lowConfidence.competition_level, 'LOW');
findings.push({id: 'A06', observed: '15 low-confidence direct classifications produce LOW instead of insufficient evidence.'});
const currencies = competition(candidates.map((c, i) => ({...c, price: i < 8 ? 10 : 100, currency: i < 8 ? 'USD' : 'PLN'})));
assert.equal(currencies.price_currency, 'EUR');
assert.equal(currencies.median_price, 10);
findings.push({id: 'A07', observed: 'With no EUR observations, USD and PLN prices are pooled and labelled EUR.'});
const validation = run(p1, 'Validate AI JSON', [
  {json: {text: JSON.stringify({results: [{source_id: 'a', decision: 'reject'}]})}},
  {json: {text: JSON.stringify({results: [{source_id: 'b', decision: 'reject'}]})}},
], {'Build AI batches of 5': [{json: {candidates: [{source_id: 'a'}]}}, {json: {candidates: [{source_id: 'b'}]}}]});
assert.equal(validation.length, 1);
findings.push({id: 'A08', observed: 'When passed two batch responses, the Phase 1 validator processes only the first (n8n item linking not simulated).'});
console.log(JSON.stringify({scope: 'Actual exported Code-node execution with synthetic fixtures; no live n8n run.', reproduced: findings.length, findings}, null, 2));
