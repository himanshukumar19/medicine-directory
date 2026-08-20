import Link from "next/link";

import {
  OpenFdaError,
  searchProducts,
  type Product,
  type ResultWindow,
} from "@/lib/openfda";

function displayName(product: Product): string {
  return product.brandAliases[0] ?? "Brand alias unavailable";
}

type SearchErrorState = {
  title: string;
  message: string;
};

function searchErrorState(error: unknown): SearchErrorState {
  if (!(error instanceof OpenFdaError)) {
    return {
      title: "Search unavailable",
      message: "The search could not be completed. Retry in a moment.",
    };
  }

  switch (error.kind) {
    case "transport":
      return {
        title: "Search unavailable",
        message:
          "openFDA could not be reached. Check your connection and retry the search.",
      };
    case "timeout":
      return {
        title: "Search timed out",
        message: "The openFDA search timed out. Retry the search.",
      };
    case "api-rejection":
      return {
        title: "API rejected search",
        message:
          "openFDA rejected this search request. Review the Search Term and retry.",
      };
    case "malformed-response":
      return {
        title: "Malformed source response",
        message: "openFDA returned data we could not interpret. Retry later.",
      };
    default:
      return { title: "Search unavailable", message: error.message };
  }
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams;
  const rawTerm = searchParams.term;
  const termValue = Array.isArray(rawTerm) ? rawTerm[0] : rawTerm;
  const term = termValue?.trim() || undefined;
  let result: ResultWindow | undefined;
  let errorState: SearchErrorState | undefined;

  if (term) {
    try {
      result = await searchProducts(term);
    } catch (error) {
      errorState = searchErrorState(error);
    }
  }

  return (
    <main className="site-shell">
      <header className="site-header">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            +
          </span>
          <span>Medicine Directory</span>
        </Link>
        <span className="header-note">OpenFDA label index</span>
      </header>

      <section className="hero" aria-labelledby="page-title">
        <p className="eyebrow">Find the source record</p>
        <h1 id="page-title">Read the label, not the rumor.</h1>
        <p className="hero-copy">
          Search US FDA label data by brand name. Open a Product record to see
          the exact source identity behind a result.
        </p>
        <form className="search-form" action="/" method="get">
          <label htmlFor="term">Search Term</label>
          <div className="search-controls">
            <input
              id="term"
              name="term"
              type="search"
              defaultValue={term}
              placeholder="Try Crocin MAX or Tylenol"
              autoComplete="off"
              required
            />
            <button type="submit">Search</button>
          </div>
        </form>
        <p className="source-note">
          Source: openFDA drug labeling. Results are unvalidated source data,
          not medical advice. This US source does not establish Indian
          availability, approval, equivalence, or substitution.
        </p>
      </section>

      <section className="results-section" aria-live="polite">
        {!term && (
          <div className="empty-state">
            <span className="empty-state-line" aria-hidden="true" />
            <p>Enter a brand name to begin.</p>
          </div>
        )}

        {errorState && (
          <div className="message-card message-card-error" role="alert">
            <p className="card-kicker">{errorState.title}</p>
            <p>{errorState.message}</p>
          </div>
        )}

        {result && (
          <>
            <div className="results-heading">
              <div>
                <p className="eyebrow">Result Window</p>
                <h2>
                  Matches for &quot;{term}&quot;
                </h2>
              </div>
              <p className="result-provenance">
                Showing {result.products.length} unique Product
                {result.products.length === 1 ? "" : "s"} from {result.total}{" "}
                Result Set entries
                <br />
                Window limit {result.limit} | offset {result.skip}
                {isPartialResultWindow(result) && (
                  <>
                    <br />
                    Partial Result Window
                  </>
                )}
              </p>
            </div>

            {result.products.length === 0 ? (
              <div className="message-card">
                <p className="card-kicker">
                  {result.total === 0 ? "No Matches" : "No Displayable Products"}
                </p>
                <p>
                  {result.total === 0
                    ? `No Products matched "${term}".`
                    : "The Result Window contained no Product with a usable Product Reference."}
                </p>
              </div>
            ) : (
              <div className="product-list">
                {result.products.map((product) => (
                  <article className="product-card" key={product.setId}>
                    <div>
                      <p className="card-kicker">Brand Alias</p>
                      <h3>{displayName(product)}</h3>
                      <p className="product-reference">
                        Product Reference: <code>{product.setId}</code>
                      </p>
                    </div>
                    <Link
                      className="product-link"
                      href={`/products/${encodeURIComponent(product.setId)}`}
                    >
                      Open Product <span aria-hidden="true">-&gt;</span>
                    </Link>
                  </article>
                ))}
              </div>
            )}

            {result.provenance.disclaimer && (
              <details className="provenance-disclosure">
                <summary>OpenFDA source disclaimer</summary>
                <p>{result.provenance.disclaimer}</p>
              </details>
            )}
          </>
        )}
      </section>

      <footer className="site-footer">
        <span>Identity is anchored to set_id.</span>
        <span>Brand names are display aliases.</span>
      </footer>
    </main>
  );
}

function isPartialResultWindow(result: ResultWindow): boolean {
  return result.skip > 0 || result.skip + result.limit < result.total;
}
