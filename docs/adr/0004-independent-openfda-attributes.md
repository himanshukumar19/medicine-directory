# Keep OpenFDA Attributes Independent

Values in separate `openfda` arrays must not be paired by index because the API does not guarantee positional correspondence between identifiers, package values, classifications, or other attributes. Each field is preserved as an independent multi-valued attribute, with `set_id` remaining the only product identity boundary established by the domain.
