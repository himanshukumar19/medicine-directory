import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductBySetId } from "@/lib/openfda";

type ProductPageProps = {
  params: Promise<{ setId: string }>;
};

export default async function ProductPage(
  props: ProductPageProps,
) {
  const { setId } = await props.params;
  const product = await getProductBySetId(setId);

  if (!product) {
    notFound();
  }

  const brandAlias = product.brandAliases[0] ?? "Brand alias unavailable";

  return (
    <main className="site-shell product-page">
      <header className="site-header">
        <Link className="wordmark" href="/">
          <span className="wordmark-mark" aria-hidden="true">
            +
          </span>
          <span>Medicine Directory</span>
        </Link>
        <Link className="back-link" href="/">
          Back to search
        </Link>
      </header>

      <article className="product-detail" aria-labelledby="product-title">
        <p className="eyebrow">Product Record</p>
        <h1 id="product-title">{brandAlias}</h1>
        <p className="detail-intro">
          This page is anchored to the source Product Reference below. The
          readable Brand Alias is a display label, not the identity.
        </p>

        <dl className="identity-list">
          <div>
            <dt>Brand Alias</dt>
            <dd>{brandAlias}</dd>
          </div>
          <div>
            <dt>Product Reference</dt>
            <dd>
              <code>{product.setId}</code>
            </dd>
          </div>
        </dl>

        <p className="detail-note">
          More label sections and source context will be added in later
          releases.
        </p>
      </article>
    </main>
  );
}
