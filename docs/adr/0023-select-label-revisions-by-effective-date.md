# Select Label Revisions by Effective Date

When multiple revisions share a `set_id`, the Preferred Label Revision is the one with the most recent valid `effective_time`; `version` is not a recency authority. If all effective dates are absent or malformed, the revisions remain ambiguous and no one is silently chosen.
