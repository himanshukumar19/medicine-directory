export type SourceField = {
  present: boolean;
  fragments: string[];
};

export type MetadataValue = string | number | boolean;

export type MetadataField = {
  name: string;
  present: boolean;
  values: MetadataValue[];
};

export type DerivedTableView = {
  rows: string[][];
};

export type LabelRevisionStatus = "preferred" | "tied" | "ambiguous";

export type PreferredLabelRevisions = {
  revisions: ProductLabel[];
  status: LabelRevisionStatus;
};

export type ProductLabel = {
  activeIngredient: SourceField;
  purpose: SourceField;
  indicationsAndUsage: SourceField;
  dosageAndAdministration: SourceField;
  dosageAndAdministrationTable: SourceField;
  safety: {
    warnings: SourceField;
    doNotUse: SourceField;
    askDoctor: SourceField;
    askDoctorOrPharmacist: SourceField;
    stopUse: SourceField;
    pregnancyOrBreastFeeding: SourceField;
    keepOutOfReachOfChildren: SourceField;
    overdosage: SourceField;
  };
  supporting: {
    inactiveIngredient: SourceField;
    otherSafetyInformation: SourceField;
    packageLabelPrincipalDisplayPanel: SourceField;
    questions: SourceField;
    storageAndHandling: SourceField;
    splProductDataElements: SourceField;
    splUnclassifiedSection: SourceField;
    recentMajorChanges: SourceField;
  };
  metadata: {
    genericName: MetadataField;
    substanceName: MetadataField;
    regulatory: MetadataField[];
  };
  provenance: {
    effectiveTime?: string;
    id?: string;
    version?: string;
    splId: MetadataField;
    splSetId: MetadataField;
  };
};

const SOURCE_FIELD_NAMES = {
  activeIngredient: "active_ingredient",
  purpose: "purpose",
  indicationsAndUsage: "indications_and_usage",
  dosageAndAdministration: "dosage_and_administration",
  dosageAndAdministrationTable: "dosage_and_administration_table",
  warnings: "warnings",
  doNotUse: "do_not_use",
  askDoctor: "ask_doctor",
  askDoctorOrPharmacist: "ask_doctor_or_pharmacist",
  stopUse: "stop_use",
  pregnancyOrBreastFeeding: "pregnancy_or_breast_feeding",
  keepOutOfReachOfChildren: "keep_out_of_reach_of_children",
  overdosage: "overdosage",
  inactiveIngredient: "inactive_ingredient",
  otherSafetyInformation: "other_safety_information",
  packageLabelPrincipalDisplayPanel: "package_label_principal_display_panel",
  questions: "questions",
  storageAndHandling: "storage_and_handling",
  splProductDataElements: "spl_product_data_elements",
  splUnclassifiedSection: "spl_unclassified_section",
  recentMajorChanges: "recent_major_changes",
} as const;

const REGULATORY_METADATA_EXCLUDED = new Set([
  "brand_name",
  "generic_name",
  "spl_id",
  "spl_set_id",
  "substance_name",
]);

const ALLOWED_RICH_TAGS = new Set([
  "br",
  "col",
  "colgroup",
  "content",
  "item",
  "list",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
]);

const VOID_RICH_TAGS = new Set(["br", "col"]);
const RICH_TAG_PATTERN = /<\/?([a-z][a-z0-9:_-]*)[^<>]*>/gi;

export function parseProductLabel(
  record: Record<string, unknown>,
): ProductLabel {
  const openFda = isRecord(record.openfda) ? record.openfda : {};

  return {
    activeIngredient: readSourceField(record, SOURCE_FIELD_NAMES.activeIngredient),
    purpose: readSourceField(record, SOURCE_FIELD_NAMES.purpose),
    indicationsAndUsage: readSourceField(
      record,
      SOURCE_FIELD_NAMES.indicationsAndUsage,
    ),
    dosageAndAdministration: readSourceField(
      record,
      SOURCE_FIELD_NAMES.dosageAndAdministration,
    ),
    dosageAndAdministrationTable: readSourceField(
      record,
      SOURCE_FIELD_NAMES.dosageAndAdministrationTable,
    ),
    safety: {
      warnings: readSourceField(record, SOURCE_FIELD_NAMES.warnings),
      doNotUse: readSourceField(record, SOURCE_FIELD_NAMES.doNotUse),
      askDoctor: readSourceField(record, SOURCE_FIELD_NAMES.askDoctor),
      askDoctorOrPharmacist: readSourceField(
        record,
        SOURCE_FIELD_NAMES.askDoctorOrPharmacist,
      ),
      stopUse: readSourceField(record, SOURCE_FIELD_NAMES.stopUse),
      pregnancyOrBreastFeeding: readSourceField(
        record,
        SOURCE_FIELD_NAMES.pregnancyOrBreastFeeding,
      ),
      keepOutOfReachOfChildren: readSourceField(
        record,
        SOURCE_FIELD_NAMES.keepOutOfReachOfChildren,
      ),
      overdosage: readSourceField(record, SOURCE_FIELD_NAMES.overdosage),
    },
    supporting: {
      inactiveIngredient: readSourceField(
        record,
        SOURCE_FIELD_NAMES.inactiveIngredient,
      ),
      otherSafetyInformation: readSourceField(
        record,
        SOURCE_FIELD_NAMES.otherSafetyInformation,
      ),
      packageLabelPrincipalDisplayPanel: readSourceField(
        record,
        SOURCE_FIELD_NAMES.packageLabelPrincipalDisplayPanel,
      ),
      questions: readSourceField(record, SOURCE_FIELD_NAMES.questions),
      storageAndHandling: readSourceField(
        record,
        SOURCE_FIELD_NAMES.storageAndHandling,
      ),
      splProductDataElements: readSourceField(
        record,
        SOURCE_FIELD_NAMES.splProductDataElements,
      ),
      splUnclassifiedSection: readSourceField(
        record,
        SOURCE_FIELD_NAMES.splUnclassifiedSection,
      ),
      recentMajorChanges: readSourceField(
        record,
        SOURCE_FIELD_NAMES.recentMajorChanges,
      ),
    },
    metadata: {
      genericName: readMetadataField(openFda, "generic_name"),
      substanceName: readMetadataField(openFda, "substance_name"),
      regulatory: Object.entries(openFda)
        .filter(([name]) => !REGULATORY_METADATA_EXCLUDED.has(name))
        .map(([name, value]) => readMetadataField(openFda, name, value))
        .filter((field) => field.present && field.values.length > 0),
    },
    provenance: {
      effectiveTime: stringValue(record.effective_time),
      id: stringValue(record.id),
      version: stringValue(record.version),
      splId: readMetadataField(openFda, "spl_id"),
      splSetId: readMetadataField(openFda, "spl_set_id"),
    },
  };
}

export function usefulFragments(field: SourceField): string[] {
  return field.fragments.filter((fragment) => fragment.trim().length > 0);
}

export function findMaterialSourceConflicts(label: ProductLabel): string[] {
  const routes = label.metadata.regulatory
    .filter((field) => field.name === "route")
    .flatMap((field) => field.values.map(String));
  const dosageText = [
    ...usefulFragments(label.dosageAndAdministration),
    ...usefulFragments(label.dosageAndAdministrationTable),
  ]
    .join(" ")
    .toLowerCase();

  if (!dosageText) {
    return [];
  }

  const hasSolidDoseInstructions = containsUnnegatedPhrase(
    dosageText,
    /\b(?:tablet|tablets|caplet|caplets|pill|pills)\b/g,
  );
  const hasOralInstructions = containsUnnegatedPhrase(
    dosageText,
    /\b(?:by mouth|orally|swallow)\b/g,
  );
  const hasTopicalInstructions = containsUnnegatedPhrase(
    dosageText,
    /\b(?:apply|cream|ointment|skin|topical)\b/g,
  );

  return routes.flatMap((route) => {
    const normalizedRoute = route.toLowerCase();
    const topicalRoute = /\b(?:topical|dermal|cutaneous)\b/.test(
      normalizedRoute,
    );
    const oralRoute = /\b(?:oral|buccal|sublingual)\b/.test(normalizedRoute);
    const nonOralRoute = /\b(?:intravenous|intramuscular|subcutaneous|ophthalmic|otic|nasal|inhalation)\b/.test(
      normalizedRoute,
    );
    const conflicts =
      (topicalRoute && (hasSolidDoseInstructions || hasOralInstructions)) ||
      (oralRoute && hasTopicalInstructions) ||
      (nonOralRoute && (hasSolidDoseInstructions || hasOralInstructions));
    const dosageDescription = hasSolidDoseInstructions
      ? "solid oral dosage instructions"
      : hasOralInstructions
        ? "oral dosage instructions"
        : "topical application instructions";

    return conflicts
      ? [
          `Source conflict: route metadata lists ${sentenceCase(route)}, while dosage text mentions ${dosageDescription}. The directory displays both source values and does not correct or clinically validate them.`,
        ]
      : [];
  });
}

function containsUnnegatedPhrase(value: string, pattern: RegExp): boolean {
  for (const match of value.matchAll(pattern)) {
    const matchIndex = match.index ?? 0;
    const precedingText = value.slice(Math.max(0, matchIndex - 24), matchIndex);

    if (!/\b(?:do not|don't|not)\b[\w\s]{0,18}$/.test(precedingText)) {
      return true;
    }
  }

  return false;
}

export function deriveDosageTable(
  fragment: string,
): DerivedTableView | undefined {
  const source = fragment.trim();
  const tableMatch = source.match(
    /^<table\b[^>]*>([\s\S]*)<\/table>$/i,
  );

  if (!tableMatch || !hasBalancedAllowedMarkup(source)) {
    return undefined;
  }

  const rows = [...tableMatch[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((rowMatch) =>
      [
        ...rowMatch[1].matchAll(
          /<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/gi,
        ),
      ].map((cellMatch) => richText(cellMatch[2])),
    )
    .filter((row) => row.length > 0 && row.some(Boolean));

  if (rows.length === 0 || rows.some((row) => row.length === 0)) {
    return undefined;
  }

  return { rows };
}

export function selectPreferredLabelRevisions(
  revisions: ProductLabel[],
): PreferredLabelRevisions {
  const datedRevisions = revisions
    .map((revision) => ({
      revision,
      timestamp: effectiveTimeTimestamp(revision.provenance.effectiveTime),
    }))
    .filter(
      (
        entry,
      ): entry is { revision: ProductLabel; timestamp: number } =>
        entry.timestamp !== undefined,
    );

  if (datedRevisions.length === 0) {
    return { revisions, status: "ambiguous" };
  }

  const latestTimestamp = Math.max(
    ...datedRevisions.map((entry) => entry.timestamp),
  );

  const preferredRevisions = datedRevisions
    .filter((entry) => entry.timestamp === latestTimestamp)
    .map((entry) => entry.revision);

  return {
    revisions: preferredRevisions,
    status: preferredRevisions.length > 1 ? "tied" : "preferred",
  };
}

export function effectiveTimeTimestamp(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.trim().match(/^(\d{4})(\d{2})(\d{2})$/);

  if (!match) {
    return undefined;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return date.getTime();
}

function readSourceField(
  record: Record<string, unknown>,
  name: string,
): SourceField {
  const value = record[name];

  return {
    present: Object.prototype.hasOwnProperty.call(record, name),
    fragments: sourceFragments(value),
  };
}

function readMetadataField(
  record: Record<string, unknown>,
  name: string,
  value = record[name],
): MetadataField {
  return {
    name,
    present: Object.prototype.hasOwnProperty.call(record, name),
    values: metadataValues(value),
  };
}

function sourceFragments(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((entry): entry is string => typeof entry === "string");
  }

  return typeof value === "string" ? [value] : [];
}

function metadataValues(value: unknown): MetadataValue[] {
  const values = Array.isArray(value) ? value : [value];

  return values.filter(
    (entry): entry is MetadataValue =>
      typeof entry === "string" ||
      typeof entry === "number" ||
      typeof entry === "boolean",
  );
}

function hasBalancedAllowedMarkup(source: string): boolean {
  const stack: string[] = [];
  let cursor = 0;

  for (const match of source.matchAll(RICH_TAG_PATTERN)) {
    const index = match.index ?? 0;
    if (source.slice(cursor, index).includes("<")) {
      return false;
    }

    const tagName = match[1].toLowerCase();
    const tag = match[0];
    const closing = tag.startsWith("</");
    const selfClosing = tag.endsWith("/>") || VOID_RICH_TAGS.has(tagName);

    if (!ALLOWED_RICH_TAGS.has(tagName)) {
      return false;
    }

    if (closing) {
      if (stack.pop() !== tagName) {
        return false;
      }
    } else if (!selfClosing) {
      stack.push(tagName);
    }

    cursor = index + tag.length;
  }

  return !source.slice(cursor).includes("<") && stack.length === 0;
}

function richText(value: string): string {
  return decodeEntities(value.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function decodeEntities(value: string): string {
  return value.replace(
    /&(#x?[\da-f]+|amp|apos|gt|lt|quot|nbsp);/gi,
    (entity, name: string) => {
      const normalizedName = name.toLowerCase();

      if (normalizedName === "amp") return "&";
      if (normalizedName === "apos") return "'";
      if (normalizedName === "gt") return ">";
      if (normalizedName === "lt") return "<";
      if (normalizedName === "quot") return '"';
      if (normalizedName === "nbsp") return " ";

      const codePoint = normalizedName.startsWith("#x")
        ? Number.parseInt(normalizedName.slice(2), 16)
        : Number.parseInt(normalizedName.slice(1), 10);

      if (!Number.isInteger(codePoint) || codePoint < 0) {
        return entity;
      }

      try {
        return String.fromCodePoint(codePoint);
      } catch {
        return entity;
      }
    },
  );
}

function sentenceCase(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
