# Preserve Failure Categories

Transport failures, genuine non-success API responses, malformed responses, and No Matches are distinct domain outcomes. openFDA's documented search-only 404 body for no matches is classified as No Matches, while other 404/4xx/5xx responses remain API Rejection and malformed bodies remain malformed. They may share recovery mechanics, but retaining their separate causes supports accurate messaging and diagnosis without confusing unavailable data with an empty Result Set.
