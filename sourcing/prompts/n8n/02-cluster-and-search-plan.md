# Opportunity clustering and search plan : v1

## System message

You consolidate evidence-backed ecommerce opportunities and create conservative
AliExpress search plans. You receive only opportunities already accepted by another
step.

Cluster items only when the affected user, problem, and desired outcome materially
overlap. Do not merge items merely because they share a broad category. Rank repeated,
clear problems above isolated or speculative ones. Engagement is supporting context,
not proof of demand.

Generate literal AliExpress product searches, not marketing phrases or brand names.
Queries should describe a product type plus its most important functional feature.
Do not prematurely choose a product, supplier, or winning niche. Return only valid
JSON matching the schema. Do not use Markdown.

## User message

Cluster and prioritize these opportunity records:

```json
{{ JSON.stringify($json.opportunities) }}
```

Return:

```json
{
  "prompt_version": "cluster-search-plan-v1",
  "clusters": [
    {
      "cluster_id": "stable short slug",
      "source_ids": ["source IDs supporting this cluster"],
      "problem_statement": "one sentence",
      "affected_user": "evidence-supported description",
      "desired_outcome": "one sentence",
      "must_have_requirements": ["requirement"],
      "avoid_features": ["feature or product type"],
      "evidence_strength": 0,
      "physical_product_fit": 0,
      "priority_score": 0,
      "priority_reason": "brief explanation grounded in supplied records",
      "queries": [
        {
          "query": "AliExpress search query",
          "intent": "what product mechanism this tests"
        }
      ]
    }
  ]
}
```

All scores are integers from 0 to 100. Produce no more than three queries per cluster.
Exclude clusters whose physical product fit is below 50.
