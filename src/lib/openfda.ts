const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";
const DEFAULT_LIMIT = 10;

export type Product = {
  setId: string;
  brandAliases: string[];
};

export type ResultSetProvenance = {
  disclaimer: string;
  lastUpdated?: string;
  license?: string;
  terms?: string;
};

export type ResultWindow = {
  products: Product[];
  total: number;
  limit: number;
  skip: number;
  provenance: ResultSetProvenance;
};

type OpenFdaRecord = {
  set_id?: unknown;
  openfda?: Record<string, unknown>;
};

type OpenFdaResponse = {
  meta?: {
    disclaimer?: unknown;
    last_updated?: unknown;
    license?: unknown;
    terms?: unknown;
    results?: {
      total?: unknown;
      limit?: unknown;
      skip?: unknown;
    };
  };
  results?: unknown;
};

export type OpenFdaErrorKind =
  | "invalid-search-term"
  | "transport"
  | "api-rejection"
  | "malformed-response";

export class OpenFdaError extends Error {
  constructor(
    public readonly kind: OpenFdaErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "OpenFdaError";
  }
}

type RequestOptions = {
  fetcher?: typeof fetch;
  limit?: number;
  skip?: number;
};

export async function searchProducts(
  searchTerm: string,
  options: RequestOptions = {},
): Promise<ResultWindow> {
  const normalizedTerm = searchTerm.trim();

  if (!normalizedTerm) {
    throw new OpenFdaError(
      "invalid-search-term",
      "A Search Term is required to search Products.",
    );
  }

  return fetchResultWindow(
    `openfda.brand_name:"${escapeSearchTerm(normalizedTerm)}"`,
    options,
  );
}

export async function getProductBySetId(
  setId: string,
  options: RequestOptions = {},
): Promise<Product | undefined> {
  const normalizedSetId = setId.trim();

  if (!normalizedSetId) {
    return undefined;
  }

  const result = await fetchResultWindow(
    `set_id:"${escapeSearchTerm(normalizedSetId)}"`,
    { ...options, limit: 1 },
  );

  return result.products.find((product) => product.setId === normalizedSetId);
}

async function fetchResultWindow(
  search: string,
  { fetcher = globalThis.fetch, limit = DEFAULT_LIMIT, skip = 0 }: RequestOptions,
): Promise<ResultWindow> {
  const requestUrl = new URL(OPENFDA_LABEL_URL);
  requestUrl.searchParams.set("search", search);
  requestUrl.searchParams.set("limit", String(limit));
  requestUrl.searchParams.set("skip", String(skip));

  let response: Response;

  try {
    response = await fetcher(requestUrl.toString(), { cache: "no-store" });
  } catch (error) {
    throw new OpenFdaError(
      "transport",
      error instanceof Error ? error.message : "The openFDA request failed.",
    );
  }

  if (!response.ok) {
    throw new OpenFdaError(
      "api-rejection",
      `openFDA rejected the request with status ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = await response.json();
  } catch {
    throw new OpenFdaError(
      "malformed-response",
      "openFDA returned invalid JSON.",
    );
  }

  return parseResultWindow(payload);
}

function parseResultWindow(payload: unknown): ResultWindow {
  if (!isRecord(payload)) {
    throw malformedResponse();
  }

  const response = payload as OpenFdaResponse;
  const meta = response.meta;
  const resultMetadata = meta?.results;

  if (
    !meta ||
    !resultMetadata ||
    !Array.isArray(response.results) ||
    !isNonNegativeNumber(resultMetadata.total) ||
    !isNonNegativeNumber(resultMetadata.limit) ||
    !isNonNegativeNumber(resultMetadata.skip)
  ) {
    throw malformedResponse();
  }

  const products = deduplicateProducts(response.results);

  return {
    products,
    total: resultMetadata.total,
    limit: resultMetadata.limit,
    skip: resultMetadata.skip,
    provenance: {
      disclaimer: stringValue(meta.disclaimer) ?? "",
      lastUpdated: stringValue(meta.last_updated),
      license: stringValue(meta.license),
      terms: stringValue(meta.terms),
    },
  };
}

function deduplicateProducts(records: unknown[]): Product[] {
  const products = new Map<string, Product>();

  for (const record of records) {
    if (!isRecord(record)) {
      continue;
    }

    const productRecord = record as OpenFdaRecord;
    const setId = stringValue(productRecord.set_id)?.trim();
    const brandAliases = stringArray(productRecord.openfda?.brand_name);

    if (!setId) {
      continue;
    }

    const existingProduct = products.get(setId);

    if (existingProduct) {
      for (const brandAlias of brandAliases) {
        if (!existingProduct.brandAliases.includes(brandAlias)) {
          existingProduct.brandAliases.push(brandAlias);
        }
      }
      continue;
    }

    products.set(setId, {
      setId,
      brandAliases,
    });
  }

  return [...products.values()];
}

function escapeSearchTerm(value: string): string {
  return value.replaceAll('"', '\\"');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function malformedResponse(): OpenFdaError {
  return new OpenFdaError(
    "malformed-response",
    "openFDA returned a response with an unrecognized shape.",
  );
}
