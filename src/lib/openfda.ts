import {
  parseProductLabel,
  selectPreferredLabelRevisions,
  type LabelRevisionStatus,
  type ProductLabel,
} from "./product-label";

const OPENFDA_LABEL_URL = "https://api.fda.gov/drug/label.json";
const DEFAULT_LIMIT = 10;
const DETAIL_LIMIT = 100;
const DEFAULT_TIMEOUT_MS = 10_000;

export type Product = {
  setId: string;
  brandAliases: string[];
  labelRevisions?: ProductLabel[];
  labelRevisionStatus?: LabelRevisionStatus;
};

export type ProductDetails = Product & {
  labelRevisions: ProductLabel[];
  labelRevisionStatus: LabelRevisionStatus;
  provenance: ResultSetProvenance;
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
  | "no-matches"
  | "transport"
  | "timeout"
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
  timeoutMs?: number;
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
    { ...options, classify404NoMatches: true },
  );
}

export async function getProductBySetId(
  setId: string,
  options: RequestOptions = {},
): Promise<ProductDetails | undefined> {
  const normalizedSetId = setId.trim();

  if (!normalizedSetId) {
    return undefined;
  }

  const detailResult = await fetchAllProductDetailPages(
    `set_id:"${escapeSearchTerm(normalizedSetId)}"`,
    { ...options, includeLabel: true, limit: DETAIL_LIMIT },
  );

  const product = detailResult.products.find(
    (candidate) => candidate.setId === normalizedSetId,
  );

  if (!product?.labelRevisions) {
    return undefined;
  }

  const selection = selectPreferredLabelRevisions(
    uniqueLabelRevisions(product.labelRevisions),
  );

  return {
    ...product,
    labelRevisions: selection.revisions,
    labelRevisionStatus: selection.status,
    provenance: detailResult.provenance,
  };
}

type FetchResultOptions = RequestOptions & {
  classify404NoMatches?: boolean;
  includeLabel?: boolean;
};

async function fetchResultWindow(
  search: string,
  {
    classify404NoMatches = false,
    fetcher = globalThis.fetch,
    includeLabel = false,
    limit = DEFAULT_LIMIT,
    skip = 0,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  }: FetchResultOptions,
): Promise<ResultWindow> {
  const requestUrl = new URL(OPENFDA_LABEL_URL);
  requestUrl.searchParams.set("search", search);
  requestUrl.searchParams.set("limit", String(limit));
  requestUrl.searchParams.set("skip", String(skip));

  let response: Response;
  const timeoutController = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      const timeoutError = new DOMException(
        "The openFDA request timed out.",
        "TimeoutError",
      );
      timeoutController.abort(timeoutError);
      reject(timeoutError);
    }, timeoutMs);
  });

  try {
    response = await Promise.race([
      fetcher(requestUrl.toString(), {
        cache: "no-store",
        signal: timeoutController.signal,
      }),
      timeoutPromise,
    ]);
  } catch (error) {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }

    if (timeoutController.signal.aborted || isTimeoutError(error)) {
      throw new OpenFdaError(
        "timeout",
        "The openFDA request timed out.",
      );
    }

    throw new OpenFdaError(
      "transport",
      error instanceof Error ? error.message : "The openFDA request failed.",
    );
  }

  if (!response.ok) {
    let isNoMatches = false;

    try {
      if (response.status === 404 && classify404NoMatches) {
        const errorPayload = await Promise.race([response.json(), timeoutPromise]);
        isNoMatches = isNoMatchesPayload(errorPayload);
      }
    } catch (error) {
      if (timeoutController.signal.aborted || isTimeoutError(error)) {
        throw new OpenFdaError(
          "timeout",
          "The openFDA request timed out.",
        );
      }
    } finally {
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    }

    if (isNoMatches) {
      throw new OpenFdaError(
        "no-matches",
        "openFDA returned no matching Products.",
      );
    }

    throw new OpenFdaError(
      "api-rejection",
      `openFDA rejected the request with status ${response.status}.`,
    );
  }

  let payload: unknown;

  try {
    payload = await Promise.race([response.json(), timeoutPromise]);
  } catch (error) {
    if (timeoutController.signal.aborted || isTimeoutError(error)) {
      throw new OpenFdaError(
        "timeout",
        "The openFDA request timed out.",
      );
    }

    throw new OpenFdaError(
      "malformed-response",
      "openFDA returned invalid JSON.",
    );
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }

  return parseResultWindow(payload, includeLabel);
}

async function fetchAllProductDetailPages(
  search: string,
  options: FetchResultOptions,
): Promise<{ products: Product[]; provenance: ResultSetProvenance }> {
  const firstPage = await fetchResultWindow(search, options);

  if (firstPage.limit <= 0 || firstPage.skip + firstPage.limit >= firstPage.total) {
    return { products: firstPage.products, provenance: firstPage.provenance };
  }

  const products = [...firstPage.products];
  let nextSkip = firstPage.skip + firstPage.limit;
  const visitedSkips = new Set([firstPage.skip]);

  while (nextSkip < firstPage.total) {
    const page = await fetchResultWindow(search, {
      ...options,
      skip: nextSkip,
    });

    if (
      page.limit <= 0 ||
      page.skip !== nextSkip ||
      visitedSkips.has(page.skip)
    ) {
      break;
    }

    mergeProducts(products, page.products);
    visitedSkips.add(page.skip);
    nextSkip += page.limit;
  }

  return { products, provenance: firstPage.provenance };
}

function parseResultWindow(payload: unknown, includeLabel: boolean): ResultWindow {
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

  const products = deduplicateProducts(response.results, includeLabel);

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

function deduplicateProducts(records: unknown[], includeLabel: boolean): Product[] {
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
      if (includeLabel) {
        existingProduct.labelRevisions?.push(parseProductLabel(productRecord));
      }
      continue;
    }

    const product: Product = {
      setId,
      brandAliases,
    };

    if (includeLabel) {
      product.labelRevisions = [parseProductLabel(productRecord)];
    }

    products.set(setId, product);
  }

  return [...products.values()];
}

function mergeProducts(target: Product[], source: Product[]): void {
  for (const sourceProduct of source) {
    const targetProduct = target.find(
      (product) => product.setId === sourceProduct.setId,
    );

    if (!targetProduct) {
      target.push(sourceProduct);
      continue;
    }

    for (const brandAlias of sourceProduct.brandAliases) {
      if (!targetProduct.brandAliases.includes(brandAlias)) {
        targetProduct.brandAliases.push(brandAlias);
      }
    }

    if (sourceProduct.labelRevisions) {
      targetProduct.labelRevisions?.push(...sourceProduct.labelRevisions);
    }
  }
}

function uniqueLabelRevisions(revisions: ProductLabel[]): ProductLabel[] {
  const seen = new Set<string>();

  return revisions.filter((revision) => {
    const key = JSON.stringify(revision);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
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

function isNoMatchesPayload(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.error)) {
    return false;
  }

  const code = stringValue(payload.error.code)?.trim().toUpperCase();
  const message = stringValue(payload.error.message)?.trim().toLowerCase();

  return code === "NOT_FOUND" && message === "no matches found!";
}

function malformedResponse(): OpenFdaError {
  return new OpenFdaError(
    "malformed-response",
    "openFDA returned a response with an unrecognized shape.",
  );
}

function isTimeoutError(error: unknown): boolean {
  if (!isRecord(error)) {
    return false;
  }

  const name = stringValue(error.name)?.toLowerCase();
  const message = stringValue(error.message)?.toLowerCase();

  return (
    name === "timeouterror" ||
    name === "etimedout" ||
    Boolean(message && /\btimeout\b|\btimed out\b/.test(message))
  );
}
