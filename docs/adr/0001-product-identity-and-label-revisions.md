# Product Identity and Label Revisions

openFDA search results must be modeled as Products identified by `set_id`, not as brands or individual label documents. A Product may have multiple Brand Aliases, while `spl_id`, `version`, and `effective_time` are retained as Label Revision provenance; this avoids exposing label revisions as separate medicines while preserving source recency and traceability.

## Considered Options

- Treat the brand name as the identity: rejected because one brand query returns materially different products and formulations.
- Treat every `spl_id` as a product: rejected because label revisions would appear as duplicate medicines.
