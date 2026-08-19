# Preserve Failure Categories

Transport failures, non-success API responses, malformed responses, and valid No Matches are distinct domain outcomes. They may share recovery mechanics, but retaining their separate causes supports accurate messaging and diagnosis without confusing unavailable data with an empty Result Set.
