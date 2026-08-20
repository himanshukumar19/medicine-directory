# Distinguish Empty and Malformed Results

A valid Result Set with zero Products is No Matches and must remain distinct from a Malformed Response. For search requests, the openFDA 404 response whose body is exactly identified by `error.code` `NOT_FOUND` and `error.message` `No matches found!` is the source's alternate No Matches representation; it is normalized to the same user-facing outcome without inventing Result Set metadata. Other non-success responses and malformed bodies remain their existing failure categories.
