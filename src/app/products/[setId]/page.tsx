import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  OpenFdaError,
  getProductBySetId,
  type ResultSetProvenance,
} from "@/lib/openfda";
import {
  deriveDosageTable,
  effectiveTimeTimestamp,
  findMaterialSourceConflicts,
  usefulFragments,
  type LabelRevisionStatus,
  type MetadataField,
  type ProductLabel,
  type SourceField,
} from "@/lib/product-label";

type ProductPageProps = {
  params: Promise<{ setId: string }>;
};

type ProductBadge = {
  label: "Route" | "Form";
  value: string;
};

const MARKET_PROVENANCE_COPY =
  "This US FDA source does not establish Indian availability, Indian approval, formulation equivalence, or substitution guidance.";

export async function generateMetadata({
  params,
}: ProductPageProps): Promise<Metadata> {
  const { setId } = await params;

  try {
    const product = await getProductBySetId(setId);

    if (product) {
      return {
        title: `${displayBrandAlias(product)} Product Label | Medicine Directory`,
        description: productDescription(product),
      };
    }
  } catch {
    // The page still renders its recoverable error state when the source fails.
  }

  return {
    title: "Product Record | Medicine Directory",
    description:
      "A Product record sourced from US FDA labeling through openFDA.",
    robots: { index: false, follow: true },
  };
}

export default async function ProductPage(
  props: ProductPageProps,
) {
  const { setId } = await props.params;
  let product: Awaited<ReturnType<typeof getProductBySetId>>;
  let errorMessage: string | undefined;

  try {
    product = await getProductBySetId(setId);
  } catch (error) {
    if (isUnknownProductError(error)) {
      notFound();
    }
    errorMessage = productErrorMessage(error);
  }

  if (errorMessage) {
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

        <article className="product-detail" aria-labelledby="product-error-title">
          <p className="eyebrow">Product Record</p>
          <div className="message-card message-card-error" role="alert">
            <p className="card-kicker" id="product-error-title">
              Product unavailable
            </p>
            <p>{errorMessage}</p>
          </div>
        </article>
      </main>
    );
  }

  if (!product) {
    notFound();
  }

  const brandAlias = displayBrandAlias(product);
  const productBadges =
    product.labelRevisions.length === 1
      ? getProductBadges(product.labelRevisions[0])
      : [];

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
        <div className="product-heading">
          <div>
            <p className="eyebrow">Product Record</p>
            <h1 id="product-title">{brandAlias}</h1>
          </div>
          <ProductBadges badges={productBadges} />
        </div>
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

        <SourceTrustBoundary provenance={product.provenance} />

        <LabelContent
          labels={product.labelRevisions}
          revisionStatus={product.labelRevisionStatus}
        />
      </article>
    </main>
  );
}

function displayBrandAlias(product: { brandAliases: string[] }): string {
  return product.brandAliases[0] ?? "Brand alias unavailable";
}

function productDescription(
  product: NonNullable<Awaited<ReturnType<typeof getProductBySetId>>>,
): string {
  const sourceContext =
    product.labelRevisionStatus === "preferred"
      ? getReadableLabelContext(product.labelRevisions[0])
      : undefined;
  const context = sourceContext
    ? ` ${sourceContext}.`
    : "";

  return `Read the US FDA label source for ${displayBrandAlias(product)}.${context} This page presents unvalidated source data. ${MARKET_PROVENANCE_COPY}`;
}

function getReadableLabelContext(label: ProductLabel | undefined): string | undefined {
  if (!label) {
    return undefined;
  }

  const activeIngredient = firstUsefulFragment(label.activeIngredient);

  if (activeIngredient) {
    return `Label-provided Active Ingredient Text: ${readableMetadataText(activeIngredient)}`;
  }

  const purpose = firstUsefulFragment(label.purpose);

  return purpose
    ? `Label-provided Purpose: ${readableMetadataText(purpose)}`
    : undefined;
}

function firstUsefulFragment(field: SourceField): string | undefined {
  return usefulFragments(field)[0];
}

function readableMetadataText(value: string): string {
  const normalized = value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();

  if (normalized.length <= 120) {
    return normalized;
  }

  return `${normalized.slice(0, 117).replace(/\s+\S*$/, "")}...`;
}

function SourceTrustBoundary({
  provenance,
}: {
  provenance: ResultSetProvenance;
}) {
  return (
    <section className="product-trust-boundary" aria-labelledby="trust-heading">
      <p className="eyebrow">Source and Market Context</p>
      <h2 id="trust-heading">OpenFDA Market Provenance</h2>
      <p className="label-group-intro">
        This Product is sourced from US FDA labeling through openFDA. {MARKET_PROVENANCE_COPY}
      </p>

      {provenance.lastUpdated ? (
        <dl className="identity-list trust-date-list">
          <div>
            <dt>Dataset Updated Date</dt>
            <dd>
              <code>{provenance.lastUpdated}</code>
            </dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}

function productErrorMessage(error: unknown): string {
  if (!(error instanceof OpenFdaError)) {
    return "The Product could not be loaded. Try again in a moment.";
  }

  switch (error.kind) {
    case "transport":
      return "openFDA could not be reached. Check your connection and try again.";
    case "timeout":
      return "The openFDA Product request timed out. Try again later.";
    case "api-rejection":
      return "openFDA rejected this Product request. Try again later.";
    case "malformed-response":
      return "openFDA returned data we could not interpret. Try again later.";
    default:
      return error.message;
  }
}

function isUnknownProductError(error: unknown): boolean {
  return (
    error instanceof OpenFdaError &&
    error.kind === "api-rejection" &&
    error.message.includes("status 404")
  );
}

function getProductBadges(label: ProductLabel): ProductBadge[] {
  const routeValues = uniqueValues(
    getOpenFdaValues(label, "route"),
  );
  const dosageForms = uniqueValues(getOpenFdaValues(label, "dosage_form"));

  return [
    ...routeValues.map((value) => ({
      label: "Route" as const,
      value: formatBadgeValue(value),
    })),
    ...dosageForms.map((value) => ({ label: "Form" as const, value })),
  ];
}

function ProductBadges({ badges }: { badges: ProductBadge[] }) {
  if (badges.length === 0) {
    return null;
  }

  return (
    <div className="product-badges" aria-label="Product formulation">
      {badges.map((badge) => (
        <span className="product-badge" key={`${badge.label}-${badge.value}`}>
          <span className="product-badge-label">{badge.label}</span>
          <span>{badge.value}</span>
        </span>
      ))}
    </div>
  );
}

function getOpenFdaValues(label: ProductLabel, name: string): string[] {
  return label.metadata.regulatory
    .filter((field) => field.name === name)
    .flatMap((field) => field.values.map(String));
}

function formatBadgeValue(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values)];
}

function AlertIcon() {
  return (
    <svg
      className="alert-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3.5 21 20H3l9-16.5Z" />
      <path d="M12 9v5" />
      <path d="M12 17.5h.01" />
    </svg>
  );
}

function PillIcon() {
  return (
    <svg
      className="pill-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M7.2 4.5a4.2 4.2 0 0 1 5.9 0l6.4 6.4a4.2 4.2 0 0 1-5.9 5.9l-6.4-6.4a4.2 4.2 0 0 1 0-5.9Z" />
      <path d="m9.4 6.7 7.9 7.9" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg
      className="info-icon"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 10.6v5.2" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

function LabelContent({
  labels,
  revisionStatus,
}: {
  labels: ProductLabel[];
  revisionStatus: LabelRevisionStatus;
}) {
  return (
    <div className="label-content">
      <p className="source-omission-note">
        Only source-supplied label sections are shown. An omitted or empty
        section is not a safety conclusion.
      </p>
      {labels.map((label, index) => (
        <div className="label-revision" key={label.provenance.id ?? index}>
          {labels.length > 1 ? (
            <>
              <p className="eyebrow">
                {revisionStatus === "tied"
                  ? "Co-preferred Label Revision"
                  : "Ambiguous Label Revision"}{" "}
                {index + 1}
              </p>
              <ProductBadges badges={getProductBadges(label)} />
            </>
          ) : null}
          <LabelRevisionProvenance label={label} />
          <MaterialSourceConflicts label={label} revisionIndex={index} />
          <LabelSections label={label} revisionIndex={index} />
        </div>
      ))}
    </div>
  );
}

function MaterialSourceConflicts({
  label,
  revisionIndex,
}: {
  label: ProductLabel;
  revisionIndex: number;
}) {
  const conflicts = findMaterialSourceConflicts(label);
  const headingId = `source-conflict-heading-${revisionIndex}`;

  if (conflicts.length === 0) {
    return null;
  }

  return (
    <aside className="source-conflict-caveat" aria-labelledby={headingId}>
      <p className="eyebrow" id={headingId}>
        Material Source Conflict
      </p>
      {conflicts.map((conflict, index) => (
        <p key={`source-conflict-${index}`}>{conflict}</p>
      ))}
    </aside>
  );
}

function LabelRevisionProvenance({ label }: { label: ProductLabel }) {
  const formattedEffectiveTime = formatEffectiveTime(
    label.provenance.effectiveTime,
  );

  return (
    <dl className="identity-list label-revision-provenance">
      {label.provenance.effectiveTime ? (
        <div>
          <dt>Label Effective Date</dt>
          <dd>
            {formattedEffectiveTime ? `${formattedEffectiveTime} ` : null}
            <code>{label.provenance.effectiveTime}</code>
          </dd>
        </div>
      ) : null}
      {label.provenance.version ? (
        <div>
          <dt>Label Revision Version</dt>
          <dd>
            <code>{label.provenance.version}</code>
          </dd>
        </div>
      ) : null}
      {label.provenance.id ? (
        <div>
          <dt>Label Document Identifier</dt>
          <dd>
            <code>{label.provenance.id}</code>
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

function LabelSections({
  label,
  revisionIndex,
}: {
  label: ProductLabel;
  revisionIndex: number;
}) {
  const coreFields = [
    ["active_ingredient", "Active Ingredient Text", label.activeIngredient],
    ["purpose", "Purpose", label.purpose],
    ["indications_and_usage", "Indications and Usage", label.indicationsAndUsage],
  ] as const;
  const safetyFields = [
    ["warnings", "Warnings", label.safety.warnings],
    ["do_not_use", "Do Not Use", label.safety.doNotUse],
    ["ask_doctor", "Ask a Doctor", label.safety.askDoctor],
    [
      "ask_doctor_or_pharmacist",
      "Ask a Doctor or Pharmacist",
      label.safety.askDoctorOrPharmacist,
    ],
    ["stop_use", "Stop Use", label.safety.stopUse],
    [
      "pregnancy_or_breast_feeding",
      "Pregnancy or Breast-Feeding",
      label.safety.pregnancyOrBreastFeeding,
    ],
    [
      "keep_out_of_reach_of_children",
      "Keep Out of Reach of Children",
      label.safety.keepOutOfReachOfChildren,
    ],
    ["overdosage", "Overdosage", label.safety.overdosage],
  ] as const;
  const supportingFields = [
    [
      "inactive_ingredient",
      "Inactive Ingredient",
      label.supporting.inactiveIngredient,
    ],
    [
      "other_safety_information",
      "Other Safety Information",
      label.supporting.otherSafetyInformation,
    ],
    [
      "package_label_principal_display_panel",
      "Package Label Principal Display Panel",
      label.supporting.packageLabelPrincipalDisplayPanel,
    ],
    ["storage_and_handling", "Storage and Handling", label.supporting.storageAndHandling],
    [
      "spl_product_data_elements",
      "SPL Product Data Elements",
      label.supporting.splProductDataElements,
    ],
    [
      "spl_unclassified_section",
      "SPL Unclassified Section",
      label.supporting.splUnclassifiedSection,
    ],
    [
      "recent_major_changes",
      "Recent Major Changes",
      label.supporting.recentMajorChanges,
    ],
  ] as const;

  const hasCoreFields = coreFields.some(([, , field]) => usefulFragments(field).length > 0);
  const hasSafetyFields = safetyFields.some(
    ([, , field]) => usefulFragments(field).length > 0,
  );
  const hasSupportingFields = supportingFields.some(
    ([, , field]) => usefulFragments(field).length > 0,
  );
  const hasDosage =
    usefulFragments(label.dosageAndAdministration).length > 0 ||
    usefulFragments(label.dosageAndAdministrationTable).length > 0;
  const hasMetadata =
    label.metadata.genericName.values.length > 0 ||
    label.metadata.substanceName.values.length > 0 ||
    label.metadata.regulatory.length > 0 ||
    label.provenance.splId.values.length > 0 ||
    label.provenance.splSetId.values.length > 0;
  const hasQuestions = usefulFragments(label.supporting.questions).length > 0;

  return (
    <div className="label-sections">
      {hasCoreFields || hasDosage ? (
        <section
          className="label-group label-group-core"
          aria-labelledby={`core-label-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Source Label</p>
          <h2 id={`core-label-heading-${revisionIndex}`}>Core Label Content</h2>
          <div className="source-section-list">
            {coreFields.map(([fieldName, title, field]) => (
              <SourceSection
                key={fieldName}
                fieldName={fieldName}
                field={field}
                title={title}
              />
            ))}
            <DosageSection label={label} />
          </div>
        </section>
      ) : null}

      {hasSafetyFields ? (
        <section
          className="label-group label-group-safety"
          aria-labelledby={`safety-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Independent Source Fields</p>
          <h2
            className="section-heading section-heading-safety"
            id={`safety-heading-${revisionIndex}`}
          >
            <AlertIcon />
            <span>Safety Fields</span>
          </h2>
          <p className="label-group-intro">
            Only safety fields supplied by the source are shown. An omitted or
            empty field is not a safety conclusion.
          </p>
          <div className="source-section-list">
            {safetyFields.map(([fieldName, title, field]) => (
              <SourceSection
                key={fieldName}
                fieldName={fieldName}
                field={field}
                title={title}
              />
            ))}
          </div>
        </section>
      ) : null}

      {hasSupportingFields || hasQuestions || hasMetadata ? (
        <details className="source-metadata-disclosure" open={false}>
          <summary>
            <span className="disclosure-title">
              Show regulatory and source metadata
            </span>
            <span className="disclosure-action">
              <span className="disclosure-closed">Show more</span>
              <span className="disclosure-open">Show less</span>
            </span>
          </summary>
          <div className="source-metadata-disclosure-content">
            {hasSupportingFields || hasQuestions ? (
              <section
                className="label-group label-group-supporting"
                aria-labelledby={`supporting-heading-${revisionIndex}`}
              >
                <p className="eyebrow">Source Label Context</p>
                <h2 id={`supporting-heading-${revisionIndex}`}>
                  Supporting Label Artifacts
                </h2>
                <p className="label-group-intro">
                  These fields are shown as source content and do not replace
                  the core label sections above.
                </p>
                <div className="source-section-list">
                  {supportingFields.map(([fieldName, title, field]) => (
                    <SourceSection
                      key={fieldName}
                      fieldName={fieldName}
                      field={field}
                      title={title}
                    />
                  ))}
                  <SourceSection
                    fieldName="questions"
                    field={label.supporting.questions}
                    title="Label Contact Text"
                    note="Label contact text printed on this label."
                  />
                </div>
              </section>
            ) : null}

            {hasMetadata ? (
              <MetadataSection label={label} revisionIndex={revisionIndex} />
            ) : null}
          </div>
        </details>
      ) : null}
    </div>
  );
}

function SourceSection({
  field,
  fieldName,
  note,
  title,
}: {
  field: SourceField;
  fieldName: string;
  note?: string;
  title: string;
}) {
  const fragments = usefulFragments(field);

  if (fragments.length === 0) {
    return null;
  }

  return (
    <section className="source-section" data-source-field={fieldName}>
      <h3
        className={
          fieldName === "active_ingredient"
            ? "source-section-heading"
            : undefined
        }
      >
        {fieldName === "active_ingredient" ? <PillIcon /> : null}
        <span>{title}</span>
      </h3>
      {note ? <p className="source-section-note">{note}</p> : null}
      <div className="source-fragments">
        {fragments.map((fragment, index) => (
          <SourceFragment
            key={`${fieldName}-${index}`}
            fragment={fragment}
          />
        ))}
      </div>
    </section>
  );
}

function SourceFragment({
  fragment,
}: {
  fragment: string;
}) {
  if (fragment.length <= 520) {
    return <p className="source-fragment">{fragment}</p>;
  }

  const preview = `${fragment
    .slice(0, 320)
    .replace(/\s+\S*$/, "")}…`;

  return (
    <details className="long-source-disclosure">
      <summary>
        <span className="long-source-preview">{preview}</span>
        <span className="disclosure-action">Read full text</span>
      </summary>
      <p className="source-fragment long-source-full">{fragment}</p>
    </details>
  );
}

function DosageSection({ label }: { label: ProductLabel }) {
  const plainFragments = usefulFragments(label.dosageAndAdministration);
  const richFragments = usefulFragments(label.dosageAndAdministrationTable);

  if (plainFragments.length === 0 && richFragments.length === 0) {
    return null;
  }

  return (
    <section className="source-section dosage-section" data-source-field="dosage_and_administration">
      <h3>Dosage and Administration</h3>
      {plainFragments.map((fragment, index) => (
        <SourceFragment
          key={`dosage-${index}`}
          fragment={fragment}
        />
      ))}
      {richFragments.map((fragment, index) => {
        const table = deriveDosageTable(fragment);

        return (
          <div
            key={`dosage-table-${index}`}
            className="rich-source-fragment"
            data-rich-source-fragment="dosage_and_administration_table"
          >
            {table ? (
              <div className="derived-table-view">
                <p className="source-section-note">Derived table view</p>
                <table>
                  <tbody>
                    {table.rows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td key={`cell-${rowIndex}-${cellIndex}`}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <details className="raw-source-disclosure">
              <summary>
                <span>Raw dosage source fragment</span>
                <span className="disclosure-action">Show raw</span>
              </summary>
              <pre>{fragment}</pre>
            </details>
          </div>
        );
      })}
    </section>
  );
}

function MetadataSection({
  label,
  revisionIndex,
}: {
  label: ProductLabel;
  revisionIndex: number;
}) {
  const metadataFields = [
    ["Generic Name Metadata", label.metadata.genericName],
    ["Substance Name Metadata", label.metadata.substanceName],
    ...label.metadata.regulatory.map((field) => [
      `openFDA ${formatMetadataName(field.name)}`,
      field,
    ] as const),
  ] as const;
  const provenanceFields = [
    ["openFDA SPL ID (Label Document Identifier)", label.provenance.splId],
    ["SPL Set Provenance", label.provenance.splSetId],
  ] as const;
  const hasMetadataFields = metadataFields.some(
    ([, field]) => field.values.length > 0,
  );
  const hasProvenanceFields = provenanceFields.some(
    ([, field]) => field.values.length > 0,
  );

  return (
    <>
      {hasProvenanceFields ? (
        <section
          className="label-group label-group-metadata"
          aria-labelledby={`provenance-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Product Provenance</p>
          <h2
            className="section-heading section-heading-metadata"
            id={`provenance-heading-${revisionIndex}`}
          >
            <InfoIcon />
            <span>SPL Source Identifiers</span>
          </h2>
          <p className="label-group-intro">
            These identifiers remain separate source values and do not replace
            the Product Reference above.
          </p>
          <dl className="metadata-list">
            {provenanceFields.map(([title, field]) => (
              <MetadataFieldView key={field.name} field={field} title={title} />
            ))}
          </dl>
        </section>
      ) : null}
      {hasMetadataFields ? (
        <section
          className="label-group label-group-metadata"
          aria-labelledby={`metadata-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Independent Attributes</p>
          <h2
            className="section-heading section-heading-metadata"
            id={`metadata-heading-${revisionIndex}`}
          >
            <InfoIcon />
            <span>Regulatory Metadata</span>
          </h2>
          <p className="label-group-intro">
            These values are shown independently as supplied under the openFDA
            namespace and are not application-validated facts.
          </p>
          <dl className="metadata-list">
            {metadataFields.map(([title, field]) => (
              <MetadataFieldView key={field.name} field={field} title={title} />
            ))}
          </dl>
        </section>
      ) : null}
    </>
  );
}

function MetadataFieldView({
  field,
  title,
}: {
  field: MetadataField;
  title: string;
}) {
  if (field.values.length === 0) {
    return null;
  }

  return (
    <div className="metadata-field">
      <dt>{title}</dt>
      <dd>
        {field.values.map((value, index) => (
          <span key={`${field.name}-${index}`} className="metadata-value">
            {String(value)}
          </span>
        ))}
      </dd>
    </div>
  );
}

function formatMetadataName(name: string): string {
  return name
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatEffectiveTime(value: string | undefined): string | undefined {
  const timestamp = effectiveTimeTimestamp(value);

  if (timestamp === undefined) {
    return undefined;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(timestamp));
}
