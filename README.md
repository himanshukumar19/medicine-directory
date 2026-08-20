# Medicine Directory

A Next.js and TypeScript directory for searching [openFDA](https://open.fda.gov/) drug-label Products and reading the source label content. The app is deliberately a source viewer, not a clinical recommendation tool.

## Getting Started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Product, SEO, and Layout Decisions

### Product identity

`set_id` is the Product identity and the detail-route key. A brand name is only a Search Term or Brand Alias: one brand query can return different strengths, ingredients, routes, and formulations, and label revisions are not separate Products. Using `set_id` avoids duplicate or ambiguous detail pages; `spl_id`, `version`, and `effective_time` remain label-revision provenance. Records without a usable `set_id` are not made routable by inventing an ID from a brand name or array position. These decisions are recorded in [`CONTEXT.md`](CONTEXT.md) and ADRs [0001](docs/adr/0001-product-identity-and-label-revisions.md), [0020](docs/adr/0020-reference-products-by-set-id.md), and [0021](docs/adr/0021-do-not-fabricate-product-identities.md).

The route and dosage-form badges exist because a familiar brand can represent materially different Products. They make formulation context scannable beside the title, but they do not define identity or validate a formulation. The badges use only explicit `openfda.route` and `openfda.dosage_form` metadata. The UI does not guess a form by scanning label prose, packaging text, or ingredient names, and it does not merge badge values across ambiguous revisions.

### Content hierarchy and safety

The detail page keeps Active Ingredient Text, Purpose, Indications and Usage, Dosage and Administration, and supplied Safety Fields in the main reading path. Regulatory metadata, SPL identifiers, supporting label artifacts, and raw rich dosage fragments are behind a disclosure because they matter for provenance and inspection but are lower-relevance for a first read. Rich dosage markup is treated as untrusted source data: a derived table is shown only when it can be parsed, with the raw fragment retained as fallback.

Source arrays remain ordered fragments under their original field boundaries, even when text repeats across fields. A route-versus-dosage contradiction is retained rather than silently corrected; only a safety-relevant Material Source Conflict gets a concise user-facing caveat.

Missing and empty safety fields are intentionally not presented as reassurance. The parser preserves the difference between an Absent Section and a present-but-empty fragment, while both are omitted from ordinary content when they contain nothing useful. Each safety field is independent: an absent `warnings` field does not imply no warnings, and `warnings` is not treated as a complete safety summary. The page says that omitted or empty sections are not a safety conclusion. A valid Product with sparse metadata remains navigable as long as `set_id` exists.

### India-specific trust decisions

openFDA data is US FDA labeling. It does not establish Indian availability, Indian approval, formulation equivalence, or substitution guidance. This matters especially for recognizable names such as Crocin, where a reader could otherwise infer that a US label is an Indian-market product. The homepage puts the source and market caveat next to the search action; a direct Product URL gets a dedicated **OpenFDA Market Provenance** boundary immediately after Product identity and before label content, so the limitation is visible without requiring prior navigation.

The openFDA API Disclaimer stays at the shared search Result Set boundary because it qualifies the response as a source, not an individual Product Safety Field. On Product pages, `meta.last_updated` is labeled **Dataset Updated Date** and `effective_time` is labeled **Label Effective Date**; neither is collapsed into a vague "last updated" claim. Source storage instructions keep their original units and packaging wording rather than being adapted into India-specific climate advice. Label contact text is framed as contact information printed on the label, not an app helpline.

### SEO and metadata

Issue #5 uses Next.js `generateMetadata` for Product-level metadata. A healthy detail page gets a readable title such as `Crocin MAX Product Label | Medicine Directory` and a description built from the Brand Alias plus explicitly labeled source context, such as Active Ingredient Text or Purpose. The description also identifies the data as unvalidated US FDA source data and repeats the market-provenance limits without claiming clinical validation or Indian equivalence.

SEO does not silently choose the first label when revisions are tied or their dates cannot establish recency. In those cases it uses a generic Product description rather than indexing arbitrary source context. A failed Product lookup falls back to non-indexable metadata. The page structure uses semantic headings and a mobile-first hierarchy so the indexed content remains understandable when reached directly.

## What I Would Do Differently With More Time

- Add real search pagination. The current homepage reports the returned count, API `total`, `limit`, `skip`, and a Partial Result Window indicator, but it does not provide controls to move beyond the first search window.
- Make the API-rejected-search state friendlier when the upstream response is effectively a no-match case. The domain should keep rejection and No Matches distinct for diagnosis, while the user-facing copy should not ask someone to review a Search Term when no matching label was found.
- Broaden fixture and rendered-test coverage beyond the current Advil, Crocin, and Tylenol samples. I would add more realistic brand/formulation combinations, non-oral routes, tied and sparse revisions, present-but-empty safety fields, and additional Indian-user scenarios.
- Reduce the cost of detail-page revision lookup. The Product route walks label-result pages to select the latest valid `effective_time`; an upstream response with a small effective page size can require many sequential requests for a Product with many revisions.

## Time and AI Harness

OpenCode was the primary implementation harness. The work took roughly **8-10 hours** total, in this sequence:

1. A domain-modeling session using `grill-with-docs`, producing [`CONTEXT.md`](CONTEXT.md) and [`docs/adr/`](docs/adr/).
2. Spec and ticket generation using `to-spec` and `to-tickets`, published to GitHub Issues.
3. Implementation of issues **#2, #4, #3, and #5**, in that order.
4. A final UI restyling pass.

The full OpenCode session transcripts are in [`prompt-history.md`](prompt-history.md).
