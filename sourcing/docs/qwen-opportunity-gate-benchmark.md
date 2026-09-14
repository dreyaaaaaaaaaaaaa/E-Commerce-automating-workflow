# Qwen opportunity-gate benchmark

Use this before enabling automatic Phase 2 routing.

Create a review set of 30 Reddit posts, with the original title, content, URL, and expected human decision:

- 10 clear rejects: recipe help, travel planning, generic recommendations, professional work, medical or safety topics.
- 10 borderline cases: a real pain, but no proven unmet product gap or a likely commodity-only answer.
- 10 strong candidate cases: a specific consumer pain, failed workaround or explicit unmet constraint, and a plausible simple non-regulated physical-product direction.

For each post, human-label one of `ACCEPT`, `REJECT`, or `UNCERTAIN`, plus one short reason. Freeze this set; do not change labels after seeing a model result.

Run the current Qwen gate over the exact same 30 posts. Record decision, reason code, evidence excerpt, confidence, JSON validity, and token usage.

Promotion criteria:

- JSON-valid responses: at least 29 of 30.
- Clear-reject precision: at least 9 of 10 rejected.
- Strong-candidate recall: at least 8 of 10 accepted or uncertain, with no invented evidence.
- No safety, medical, professional, or ordinary commodity item may be accepted.
- Every accepted item must quote direct evidence of both a problem and an unmet constraint.

If Qwen misses a criterion, update the deterministic filter or prompt and re-run the same frozen set. Do not change models or tune against live Sheet rows until this benchmark passes.
