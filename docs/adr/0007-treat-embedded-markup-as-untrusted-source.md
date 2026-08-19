# Treat Embedded Markup as Untrusted Source

Fields such as `dosage_and_administration_table` are Rich Source Fragments, not trusted HTML. Their raw content remains source data, while any sanitization or table extraction is a separate derived interpretation that must tolerate malformed markup and must not directly inject the API string into the document.

The raw field remains canonical; a parsed table is only a Derived Table View and may fall back to the plain `dosage_and_administration` source text when parsing is unsuccessful.
