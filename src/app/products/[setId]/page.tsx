import Link from "next/link";
import { notFound } from "next/navigation";

import { getProductBySetId } from "@/lib/openfda";
import {
  deriveDosageTable,
  effectiveTimeTimestamp,
  usefulFragments,
  type LabelRevisionStatus,
  type MetadataField,
  type ProductLabel,
  type SourceField,
} from "@/lib/product-label";

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
          readable Brand Alias is a display label, not the identity. The source
          is US FDA labeling and does not establish Indian availability,
          approval, equivalence, or substitution guidance.
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

        <LabelContent
          labels={product.labelRevisions}
          revisionStatus={product.labelRevisionStatus}
        />
      </article>
    </main>
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
            <p className="eyebrow">
              {revisionStatus === "tied"
                ? "Co-preferred Label Revision"
                : "Ambiguous Label Revision"}{" "}
              {index + 1}
            </p>
          ) : null}
          <LabelRevisionProvenance label={label} />
          <LabelSections label={label} revisionIndex={index} />
        </div>
      ))}
    </div>
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
          className="label-group"
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
          className="label-group"
          aria-labelledby={`safety-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Independent Source Fields</p>
          <h2 id={`safety-heading-${revisionIndex}`}>Safety Fields</h2>
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

      {hasSupportingFields || hasQuestions ? (
        <section
          className="label-group"
          aria-labelledby={`supporting-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Source Label Context</p>
          <h2 id={`supporting-heading-${revisionIndex}`}>
            Supporting Label Artifacts
          </h2>
          <p className="label-group-intro">
            These fields are shown as source content and do not replace the core
            label sections above.
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
      <h3>{title}</h3>
      {note ? <p className="source-section-note">{note}</p> : null}
      <div className="source-fragments">
        {fragments.map((fragment, index) => (
          <p key={`${fieldName}-${index}`}>{fragment}</p>
        ))}
      </div>
    </section>
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
        <p key={`dosage-${index}`} className="source-fragment">
          {fragment}
        </p>
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
              <summary>Raw dosage source fragment</summary>
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
          className="label-group"
          aria-labelledby={`provenance-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Product Provenance</p>
          <h2 id={`provenance-heading-${revisionIndex}`}>
            SPL Source Identifiers
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
          className="label-group"
          aria-labelledby={`metadata-heading-${revisionIndex}`}
        >
          <p className="eyebrow">Independent Attributes</p>
          <h2 id={`metadata-heading-${revisionIndex}`}>Regulatory Metadata</h2>
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
