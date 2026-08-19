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
});
