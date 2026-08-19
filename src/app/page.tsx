import Link from "next/link";

import { OpenFdaError, searchProducts, type Product } from "@/lib/openfda";

function displayName(product: Product): string {
  return product.brandAliases[0] ?? "Brand alias unavailable";
}

function searchErrorMessage(error: unknown): string {
  if (!(error instanceof OpenFdaError)) {
    return "The search could not be completed. Try again in a moment.";
  }

  switch (error.kind) {
    case "transport":
      return "openFDA could not be reached. Check your connection and try again.";
    case "api-rejection":
      return "openFDA rejected this search. Try a different Search Term.";
    case "malformed-response":
      return "openFDA returned data we could not interpret. Try again later.";
    default:
      return error.message;
  }
}

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home(props: HomeProps) {
  const searchParams = await props.searchParams;
  const rawTerm = searchParams.term;
  const term = Array.isArray(rawTerm) ? rawTerm[0] : rawTerm;
  let result;
  let errorMessage;

  if (term?.trim()) {
    try {
      result = await searchProducts(term);
    } catch (error) {
      errorMessage = searchErrorMessage(error);
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

        {errorMessage && (
          <div className="message-card message-card-error" role="alert">
            <p className="card-kicker">Search unavailable</p>
            <p>{errorMessage}</p>
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
                {result.total} {result.total === 1 ? "Product" : "Products"} in
                the Result Set
                <br />
                Window limit {result.limit} | offset {result.skip}
              </p>
            </div>

            {result.products.length === 0 ? (
              <div className="message-card">
                <p className="card-kicker">
                  {result.total === 0 ? "No Matches" : "No Displayable Products"}
                </p>
                <p>
                  {result.total === 0
                    ? "No Products were returned for this Search Term."
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
