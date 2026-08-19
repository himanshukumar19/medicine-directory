# Preserve Label Source Fragments

Top-level openFDA `string[]` fields are treated as ordered Source Fragments and rendered without heuristic semantic splitting. This preserves the label’s wording despite duplicated headings, flattened sections, malformed text, and inconsistent array usage across Products; empty fragments may be omitted from presentation.

Absent fields and present-but-empty fragments are distinct upstream states, even though both are omitted from ordinary user-facing content.
