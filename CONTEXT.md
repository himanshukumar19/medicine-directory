# Medicine Directory Context

This context defines the domain language for presenting openFDA drug-label data. It distinguishes searchable brand concepts from the specific labeled products and label revisions returned by the API.

## Product Identity

**Product**:
A specific labeled drug product represented by an openFDA result and identified by `set_id`.
_Avoid_: Medicine as a synonym for every search result, brand

**Brand Alias**:
A brand name associated with a Product. One Product may have multiple brand aliases, and the first API value is only a display default.
_Avoid_: Product identity, formulation identity

**Label Revision**:
A particular published label document for a Product, identified by `spl_id` and described by `version` and `effective_time`.
_Avoid_: Separate product, separate medicine

**Search Term**:
The user-provided name used to find Products, commonly a brand name. It is a query concept, not a Product identity.
_Avoid_: Medicine ID, canonical product name

**Source Fragment**:
One ordered string supplied by an openFDA label field. It is rendered as source content, may contain repeated or flattened text, and is not assumed to represent one semantic item.
_Avoid_: Ingredient, warning, dosage item (unless the source explicitly establishes that meaning)

**Product Boundary**:
The `set_id` boundary defines whether two API records are distinct Products. Similar-looking ingredients, strengths, routes, or label text do not justify merging or splitting Products outside that boundary.
_Avoid_: Parser-derived identity, inferred formulation identity

**Source Conflict**:
A disagreement or apparent inconsistency between openFDA fields, such as route metadata conflicting with dosage text. It remains part of the source record and is not silently corrected or clinically validated by the directory.
_Avoid_: Application error, corrected value

**Absent Section**:
A label field that is not present in the API record, meaning the label did not supply that section.
_Avoid_: Empty section

**Empty Fragment**:
A present source-field entry whose string contains no useful content. It is omitted from user-facing content but remains distinguishable from an Absent Section for data-quality inspection.
_Avoid_: Missing field

**OpenFDA Attribute**:
An independently supplied value or set of values under the record’s `openfda` namespace. Values from different attributes are not positionally related unless the source explicitly says they are.
_Avoid_: Paired identifier, aligned metadata row

**Match**:
A Product returned by openFDA for a Search Term. A Match does not imply an exact brand-name match or that the directory independently verified the relationship.
_Avoid_: Exact match, validated match

**Result Set**:
The complete collection represented by an openFDA search response’s `total`, of which the response returns only a limited window described by `limit` and `skip`.
_Avoid_: Returned list, complete page

**Result Window**:
The Products actually returned in one response, together with its `total`, `limit`, and `skip` values. A Result Window is partial whenever its bounds do not cover the full Result Set.
_Avoid_: Complete results, all matches

**Result Set Provenance**:
Response-level information in `meta`, including the API disclaimer, source freshness, license, and terms. It describes the source for the Result Set, not any individual Product.
_Avoid_: Product disclaimer, label warning

**API Disclaimer**:
The openFDA warning that results are unvalidated and should not be relied on for medical-care decisions. It is shared source provenance and should be surfaced globally or at the Result Set boundary.
_Avoid_: Product warning, clinical advice

**Rich Source Fragment**:
A source-field string containing table or markup-like structure, such as `dosage_and_administration_table`. It is distinct from plain text, is not assumed safe or valid markup, and requires separate interpretation before presentation.
_Avoid_: Trusted HTML, plain Source Fragment

**Derived Table View**:
A best-effort interpretation of a Rich Source Fragment for presentation. It is never authoritative and may be absent or incomplete when source markup cannot be parsed; the raw fragment remains available as fallback provenance.
_Avoid_: Canonical dosage table, validated dosage data

**Source Field Boundary**:
The named field boundary supplied by the label, preserved even when content overlaps or repeats another field. Repeated source content is not removed from the underlying Product data.
_Avoid_: Deduplicated section, normalized summary

**Unlisted Safety Section**:
A safety-related field absent from a Product record. It means the source did not provide that section; it does not mean the Product is safe or has no warnings.
_Avoid_: No warnings, safe product

**Active Ingredient Text**:
The label-provided `active_ingredient` source section, including the wording and any strength, dosage-form, salt, or qualifier context supplied by the label.
_Avoid_: Generic name, substance list

**Generic Name Metadata**:
The independent `openfda.generic_name` attribute associated with a Product. It is metadata and is not a replacement or derivation of Active Ingredient Text.
_Avoid_: Active ingredient

**Substance Name Metadata**:
The independent multi-valued `openfda.substance_name` attribute associated with a Product. It identifies supplied substance names but does not carry the full label context of Active Ingredient Text.
_Avoid_: Parsed ingredients, active-ingredient prose

**Purpose**:
The label’s concise product-category text, such as pain reliever or fever reducer. It is source content, not an application-generated medical classification.
_Avoid_: Indication, diagnosis, treatment advice

**Indications and Usage**:
The label’s fuller source description of symptoms or conditions the Product is intended to relieve or treat. It is preserved as label content and is not paraphrased into medical advice.
_Avoid_: Purpose, recommendation

**Safety Field**:
Any independent safety-related label section, including `warnings`, `do_not_use`, `ask_doctor`, `ask_doctor_or_pharmacist`, `stop_use`, `pregnancy_or_breast_feeding`, `keep_out_of_reach_of_children`, and `overdosage`. No Safety Field is assumed to summarize or replace another.
_Avoid_: Complete warnings, safety summary

**Label Effective Date**:
The Product-level `effective_time` value indicating when that label became effective. It describes label provenance, not when the API dataset was refreshed.
_Avoid_: Generic last updated date

**Dataset Updated Date**:
The response-level `meta.last_updated` value indicating the freshness date of the openFDA dataset. It applies to Result Set Provenance, not to an individual Product label.
_Avoid_: Label effective date

**Raw Date Value**:
The exact date string supplied by the API, retained without silent normalization or guessing. A human-readable date is a derived view only when parsing succeeds; otherwise the date is unavailable for display.
_Avoid_: Assumed date, normalized source date

**Regulatory Metadata**:
Independent source attributes such as NDCs, application numbers, RxCUIs, UNII values, product classifications, routes, manufacturers, and packaging flags. They are retained as-is and are not interpreted, cross-referenced, or presented as application-validated facts.
_Avoid_: Verified regulatory status, clinical classification

**Supporting Label Artifact**:
An independent label field that may provide supplementary, packaging, contact, storage, or flattened SPL content. It remains available as source data but does not substitute for a core label section.
_Avoid_: Canonical ingredient data, canonical dosage data

**Unmodeled Source Field**:
An API field not yet understood by this domain model. It is tolerated as source data and not forced into an existing category or treated as malformed solely because it is unfamiliar.
_Avoid_: Invalid field, inferred field

**Malformed Response**:
An API response whose required structural shape cannot be interpreted as a Result Set, distinct from a valid response containing missing sections or Unmodeled Source Fields.
_Avoid_: Empty Result Set, no-match response

**No Matches**:
A successfully interpreted Result Set containing zero Products for a Search Term. It is a valid search outcome, not an API failure.
_Avoid_: Malformed response, failed search

**Transport Failure**:
The source could not be reached because of a network or connection failure. No claim is made about whether the Search Term has Matches.
_Avoid_: No matches, malformed response

**Timeout**:
The source request did not complete within its allowed time. It is a distinct failure from a Transport Failure, and no claim is made about whether the Search Term has Matches.
_Avoid_: No matches, transport failure, malformed response

**API Rejection**:
The source responded with a non-success HTTP outcome. It is distinct from a Transport Failure and from a response whose structure is malformed.
_Avoid_: Network error, no matches

**OpenFDA Market Provenance**:
An openFDA Product is sourced from US FDA labeling and does not establish Indian availability, approval, formulation equivalence, or substitution guidance.
_Avoid_: Indian-market product, locally approved medicine, equivalent brand

**Product Reference**:
The stable reference to a Product, based on `set_id`. A readable brand or slug may accompany it for human recognition, but cannot replace or determine Product identity.
_Avoid_: Brand-only identity, display-name identity

**Unidentifiable Record**:
An API record without a usable `set_id`. It may be retained for diagnostics, but it is not a Product, is not surfaced as a normal result, and cannot be routed to a detail view.
_Avoid_: Fallback product, synthetic product identity

**Duplicate Product Occurrence**:
An API record occurrence sharing a `set_id` with another result in the same Result Window. It represents the same Product identity and is not rendered as a separate Product.
_Avoid_: Duplicate Product, separate formulation

**Preferred Label Revision**:
The revision selected for a Product when multiple label documents share its `set_id`, chosen by the most recent valid `effective_time`. If recency cannot be established, the Product retains revision ambiguity rather than silently selecting one.
_Avoid_: Highest version, latest array item

**Tied Label Revision**:
Two or more revisions sharing the most recent valid `effective_time`. They are co-preferred for provenance, and no array order, version number, or arbitrary identifier is used as a hidden winner.
_Avoid_: Arbitrarily selected revision, canonical tie-breaker

**Recent Changes Section**:
The optional `recent_major_changes` source section. An empty or absent value means no useful change text was supplied; it does not establish that the label had no changes.
_Avoid_: No recent changes, unchanged label

**Label Document Identifier**:
An identifier for a particular label document, represented independently by top-level `id` and `openfda.spl_id` values. They may coincide in observed data but are not assumed equivalent; neither defines Product identity.
_Avoid_: Product ID, interchangeable SPL ID

**SPL Set Provenance**:
The independent `openfda.spl_set_id` value associated with a label document. Top-level `set_id` remains Product identity; disagreement between the two is a retained Source Conflict.
_Avoid_: Alternate Product ID, interchangeable set ID

**Material Source Conflict**:
A Source Conflict that can change a user’s understanding of safe use, such as route metadata contradicting dosage text. It is retained diagnostically and may warrant a concise user-facing caveat; non-material identifier conflicts remain internal diagnostics.
_Avoid_: Any discrepancy as a clinical warning, silently corrected conflict

**Label Contact Section**:
The manufacturer or label-provided contact text from `questions`. It is source content printed on the label, not an app helpline, healthcare relationship, or endorsement.
_Avoid_: App support, medical helpline, provider relationship

**Label Storage Section**:
The source-provided `storage_and_handling` instructions and related handling text. It is preserved as label content, including source units and packaging caveats, without adapting it into India-specific advice or implying independent validation.
_Avoid_: Application storage advice, climate-adjusted instruction

**Other Safety Information**:
The independent `other_safety_information` source field, which may contain mixed storage, packaging, or handling content. It remains separate even when its fragments overlap another label section.
_Avoid_: Supplemental warnings merged into warnings, storage replacement

**Package Display Panel**:
An ordered Supporting Label Artifact from `package_label_principal_display_panel` containing packaging, marketing, language, image, or pack-size text. It does not redefine Product identity or create Products from package variants.
_Avoid_: Canonical Product name, package-derived formulation

**Unclassified Label Section**:
The source-provided `spl_unclassified_section` catch-all content that openFDA did not classify more specifically. It remains independent and is not reclassified into another typed label section.
_Avoid_: Inferred warning, reclassified storage section

**Sparse Product**:
A valid Product with a usable `set_id` but absent or incomplete `openfda` metadata or label sections. It remains user-navigable, while unavailable facts degrade as unlisted rather than invalidating the Product.
_Avoid_: Invalid product, rejected product
