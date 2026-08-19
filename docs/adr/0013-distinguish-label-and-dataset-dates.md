# Distinguish Label and Dataset Dates

`effective_time` and `meta.last_updated` represent different provenance facts: the former is the Product’s Label Effective Date, while the latter is the Dataset Updated Date. They must not be collapsed into one ambiguous “last updated” value.

Date strings remain raw source values; formatting is best-effort and never guesses when parsing fails.
