const assert = require('assert');
const fs = require('fs');
const vm = require('vm');

const workflow = JSON.parse(fs.readFileSync('n8n/Dropship phase 5 v1 Product Validation.json', 'utf8'));

function code(name) {
  const node = workflow.nodes.find(candidate => candidate.name === name);
  assert(node, `Missing node: ${name}`);
  return node.parameters.jsCode;
}

function node(name) {
  const result = workflow.nodes.find(candidate => candidate.name === name);
  assert(result, `Missing node: ${name}`);
  return result;
}

function runSimple(name, rows) {
  const context = {
    $input: { all: () => rows.map(json => ({ json })) },
  };
  return vm.runInNewContext(`(() => { ${code(name)} })()`, context);
}

function runCalculation(rows) {
  const context = {
    $input: { all: () => rows.map(json => ({ json })) },
    Date,
    Number,
    String,
    Set,
    Map,
  };
  return vm.runInNewContext(`(() => { ${code('Calculate evidence and economics status')} })()`, context);
}

function runAutomatic(rows, vars = {}) {
  const context = {
    $input: { all: () => rows.map(json => ({ json })) },
    $vars: vars,
    Number,
    String,
    Map,
  };
  return vm.runInNewContext(`(() => { ${code('Apply automated Phase 5 inputs')} })()`, context);
}

const candidate = {
  _kind: 'candidate',
  evaluation_key: 'reddit:test|1005000000001|FR',
  opportunity_id: 'reddit:test',
  product_id: '1005000000001',
  product_name: 'Test product',
  product_link: 'https://www.aliexpress.com/item/1005000000001.html',
  phase3_recommendation: 'HOLD',
  phase3_score: 70,
  competition_level: 'LOW',
  competition_evidence: 'Measured sample',
  destination_country: 'FR',
  currency: 'EUR',
  supplier_item_cost_eur: 10,
};

const completeManual = {
  _kind: 'existing',
  evaluation_key: candidate.evaluation_key,
  sale_price_ttc_eur: 30,
  shipping_cost_eur: 2,
  packaging_cost_eur: 1,
  import_duty_eur: 3,
  vat_rate_pct: 20,
  payment_fee_pct: 3,
  payment_fee_fixed_eur: 0.3,
  return_reserve_eur: 1,
  acquisition_cost_eur: 5,
  delivery_days: 7,
  exact_variant_confirmed: 'YES',
  shipping_quote_confirmed: 'YES',
  dimensions_confirmed: 'NOT_APPLICABLE',
  material_confirmed: 'YES',
  compliance_checked: 'YES',
  sample_status: 'NOT_ORDERED',
  validation_notes: 'Keep this manual note',
};

const ready = runCalculation([candidate, completeManual])[0].json;
assert.strictEqual(ready.validation_status, 'READY_FOR_SAMPLE');
assert.strictEqual(ready.net_revenue_ex_vat_eur, 25);
assert.strictEqual(ready.payment_fee_eur, 1.2);
assert.strictEqual(ready.contribution_before_acquisition_eur, 6.8);
assert.strictEqual(ready.contribution_after_acquisition_eur, 1.8);
assert.strictEqual(ready.validation_notes, 'Keep this manual note');

const missing = runCalculation([candidate])[0].json;
assert.strictEqual(missing.validation_status, 'MISSING_EVIDENCE');
assert.strictEqual(missing.contribution_before_acquisition_eur, null);
assert(missing.missing_fields.includes('sale_price_ttc_eur'));

const capturedCandidate = {
  ...candidate,
  captured_shipping_cost_eur: 0,
  captured_delivery_days: 25,
  shipping_service: 'CAINIAO_STANDARD',
  shipping_quote_count: 2,
};
const automatedRows = runAutomatic([capturedCandidate]).map(item => item.json);
const automated = runCalculation(automatedRows)[0].json;
assert.strictEqual(automated.shipping_cost_eur, 0);
assert.strictEqual(automated.delivery_days, 25);
assert.strictEqual(automated.packaging_cost_eur, 0.5);
assert.strictEqual(automated.vat_rate_pct, 20);
assert(automated.sale_price_ttc_eur > automated.supplier_item_cost_eur);
assert(automated.return_reserve_eur > 0);
assert(automated.validation_notes.includes('AUTO_SCENARIO'));
assert(automated.missing_fields.includes('exact_variant_confirmed'));

const rejectedValidation = runCalculation([
  candidate,
  { ...completeManual, compliance_checked: 'NO' },
])[0].json;
assert.strictEqual(rejectedValidation.validation_status, 'REJECTED_VALIDATION');

const rejectedEconomics = runCalculation([
  candidate,
  { ...completeManual, sale_price_ttc_eur: 12 },
])[0].json;
assert.strictEqual(rejectedEconomics.validation_status, 'REJECTED_ECONOMICS');

const received = runCalculation([
  candidate,
  { ...completeManual, sample_status: 'RECEIVED_OK' },
])[0].json;
assert.strictEqual(received.validation_status, 'READY_FOR_HUMAN_APPROVAL');

assert.strictEqual(node('Get existing Phase 5 validation rows').alwaysOutputData, true);
const emptyFirstRun = runSimple('Tag existing manual validation', [{}]);
assert.strictEqual(emptyFirstRun.length, 1);
assert.strictEqual(emptyFirstRun[0].json._kind, 'existing_empty');

console.log(JSON.stringify({
  scope: 'Phase 5 deterministic economics and evidence gate',
  passed: 7,
  statuses: [
    ready.validation_status,
    missing.validation_status,
    rejectedValidation.validation_status,
    rejectedEconomics.validation_status,
    received.validation_status,
  ],
}, null, 2));
