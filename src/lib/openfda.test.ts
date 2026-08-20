import crocinFixture from "../../research/api-sample-crocin.json";
import { afterEach, describe, expect, it, vi } from "vitest";

import { searchProducts } from "./openfda";

describe("searchProducts", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a typed Result Window from an openFDA response", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(crocinFixture), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );

    const result = await searchProducts("Crocin MAX");
    const requestUrl = new URL(fetcher.mock.calls[0]?.[0] as string);

    expect(requestUrl.searchParams.get("search")).toBe(
      'openfda.brand_name:"Crocin MAX"',
    );
    expect(requestUrl.searchParams.get("limit")).toBe("10");
    expect(requestUrl.searchParams.get("skip")).toBe("0");
    expect(result).toEqual({
      products: [
        {
          brandAliases: ["Crocin MAX"],
          setId: "498c7d7e-d952-c122-e063-6394a90ae72f",
        },
      ],
      total: 1,
      limit: 5,
      skip: 0,
      provenance: {
        disclaimer: crocinFixture.meta.disclaimer,
        lastUpdated: "2026-08-19",
        license: "https://open.fda.gov/license/",
        terms: "https://open.fda.gov/terms/",
      },
    });
  });

  it("deduplicates Product occurrences by set_id and keeps their aliases", async () => {
    const firstRecord = crocinFixture.results[0];
    const duplicateRecord = {
      ...firstRecord,
      openfda: {
        ...firstRecord.openfda,
        brand_name: ["Crocin MAX", "Crocin"],
      },
    };
    const unidentifiableRecord = {
      openfda: { brand_name: ["Unroutable label"] },
    };
    const fixture = {
      ...crocinFixture,
      meta: {
        ...crocinFixture.meta,
        results: { ...crocinFixture.meta.results, total: 3 },
      },
      results: [firstRecord, duplicateRecord, unidentifiableRecord],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 }),
    );

    const result = await searchProducts("Crocin MAX");

    expect(result.products).toEqual([
      {
        brandAliases: ["Crocin MAX", "Crocin"],
        setId: "498c7d7e-d952-c122-e063-6394a90ae72f",
      },
    ]);
    expect(result.total).toBe(3);
  });

  it("returns No Matches for a valid empty Result Set", async () => {
    const fixture = {
      ...crocinFixture,
      meta: {
        ...crocinFixture.meta,
        results: { total: 0, limit: 10, skip: 0 },
      },
      results: [],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(fixture), { status: 200 }),
    );

    await expect(searchProducts("Unknown Brand")).resolves.toMatchObject({
      products: [],
      total: 0,
      limit: 10,
      skip: 0,
    });
  });

  it.each([
    {
      name: "a transport failure",
      error: new TypeError("fetch failed"),
      kind: "transport",
    },
    {
      name: "a timeout",
      error: new DOMException("The operation timed out", "TimeoutError"),
      kind: "timeout",
    },
  ])("classifies $name separately at the typed boundary", async ({ error, kind }) => {
    const fetcher = vi.fn().mockRejectedValue(error);

    await expect(
      searchProducts("Crocin MAX", { fetcher }),
    ).rejects.toMatchObject({
      kind,
    });
  });

  it("aborts an openFDA request that exceeds the configured timeout", async () => {
    const fetcher = async (
      _input: RequestInfo | URL,
      init?: RequestInit,
    ): Promise<Response> =>
      new Promise((_, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(new DOMException("The operation timed out", "TimeoutError")),
          { once: true },
        );
      });

    await expect(
      searchProducts("Crocin MAX", { fetcher, timeoutMs: 1 }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });

  it("classifies API rejection and malformed responses separately", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("rejected", { status: 503 }),
    );

    await expect(searchProducts("Crocin MAX")).rejects.toMatchObject({
      kind: "api-rejection",
    });

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response("not json", { status: 200 }),
    );

    await expect(searchProducts("Crocin MAX")).rejects.toMatchObject({
      kind: "malformed-response",
    });

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    await expect(searchProducts("Crocin MAX")).rejects.toMatchObject({
      kind: "malformed-response",
    });
  });
});
