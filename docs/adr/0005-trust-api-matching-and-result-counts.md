# Trust API Matching and Result Counts

The directory will treat openFDA-returned Products as Matches without adding its own exact-name interpretation. A response’s `total` describes the broader Result Set, while `results` is only the returned window governed by `limit` and `skip`; the distinction must remain explicit so partial results are not presented as complete.

The response envelope retains `total`, `limit`, and `skip` even if the initial release does not implement full pagination.
