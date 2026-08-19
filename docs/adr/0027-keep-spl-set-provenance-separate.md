# Keep SPL Set Provenance Separate

Top-level `set_id` is the Product identity, while `openfda.spl_set_id` is retained as independent SPL Set Provenance. If they disagree, the discrepancy remains a Source Conflict for diagnosis or disclosure rather than being silently resolved.
