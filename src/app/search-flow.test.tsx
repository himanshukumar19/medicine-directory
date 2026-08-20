import crocinFixture from "../../research/api-sample-crocin.json";
import tylenolFixture from "../../research/api-sample-tylenol.json";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import ProductPage, { generateMetadata } from "./products/[setId]/page";

const productSetId = "498c7d7e-d952-c122-e063-6394a90ae72f";

function mockProductFixture(fixture: unknown) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
    new Response(JSON.stringify(fixture), {
      headers: { "content-type": "application/json" },
      status: 200,
    }),
  );
}

async function renderProductFixture(fixture: unknown, setId = productSetId) {
  mockProductFixture(fixture);

  const detail = await ProductPage({
    params: Promise.resolve({ setId }),
  });

  return renderToStaticMarkup(detail);
}

describe("search and open a Product", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a searched Product and opens its set_id detail route", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        new Response(JSON.stringify(crocinFixture), {
          headers: { "content-type": "application/json" },
          status: 200,
        }),
      );

    const home = await Home({
      searchParams: Promise.resolve({ term: "Crocin MAX" }),
    });
    const homeMarkup = renderToStaticMarkup(home);
    const productHref = homeMarkup.match(
      new RegExp(`href="(/products/${productSetId})"`),
    )?.[1];

    expect(homeMarkup).toContain('action="/" method="get"');
    expect(homeMarkup).toContain('name="term"');
    expect(homeMarkup).toContain("Crocin MAX");
    expect(productHref).toBe(`/products/${productSetId}`);
    expect(homeMarkup).toContain("1 unique Product");

    const detail = await ProductPage({
      params: Promise.resolve({ setId: productHref?.split("/").pop() ?? "" }),
    });
    const detailMarkup = renderToStaticMarkup(detail);
    const detailRequestUrl = new URL(
      fetcher.mock.calls[1]?.[0] as string,
    );

    expect(detailRequestUrl.searchParams.get("search")).toBe(
      `set_id:"${productSetId}"`,
    );
    expect(detailMarkup).toContain("Crocin MAX");
    expect(detailMarkup).toContain(productSetId);
  });

  it("emits Product-level SEO metadata from readable source context", async () => {
    mockProductFixture(crocinFixture);

    const metadata = await generateMetadata({
      params: Promise.resolve({ setId: productSetId }),
    });

    expect(metadata.title).toBe("Crocin MAX Product Label | Medicine Directory");
    expect(metadata.description).toContain("Crocin MAX");
    expect(metadata.description).toContain("US FDA label source");
    expect(metadata.description).toContain("Indian availability");
    expect(metadata.description).toContain("substitution guidance");
    expect(metadata.description).not.toContain("clinically validated");
    expect(metadata.description).not.toContain("is equivalent");
  });

  it("does not choose one co-preferred Label Revision for SEO context", async () => {
    const originalRecord = crocinFixture.results[0];
    mockProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          active_ingredient: ["First co-preferred revision context"],
          effective_time: "20260129",
          id: "first-co-preferred-label",
        },
        {
          ...originalRecord,
          active_ingredient: ["Second co-preferred revision context"],
          effective_time: "20260129",
          id: "second-co-preferred-label",
        },
      ],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ setId: productSetId }),
    });

    expect(metadata.description).toContain("Read the US FDA label source");
    expect(metadata.description).not.toContain("First co-preferred revision context");
    expect(metadata.description).not.toContain("Second co-preferred revision context");
  });

  it("separates source trust details from Product Safety Fields", async () => {
    const detailMarkup = await renderProductFixture(crocinFixture);
    const home = await Home({
      searchParams: Promise.resolve({ term: "Crocin MAX" }),
    });
    const homeMarkup = renderToStaticMarkup(home);

    expect(detailMarkup).toContain("Product Reference");
    expect(homeMarkup).toContain("OpenFDA source disclaimer");
    expect(homeMarkup).toContain(crocinFixture.meta.disclaimer);
    expect(detailMarkup).toContain("OpenFDA Market Provenance");
    expect(detailMarkup).toContain("US FDA labeling");
    expect(detailMarkup).toContain("Indian availability");
    expect(detailMarkup).toContain("formulation equivalence");
    expect(detailMarkup).toContain("substitution guidance");
    expect(detailMarkup).toContain("Dataset Updated Date");
    expect(detailMarkup).toContain("2026-08-19");
    expect(detailMarkup).toContain("Label Effective Date");
    expect(detailMarkup).not.toContain("Last Updated");
    expect(detailMarkup).toMatch(/<h1 id="product-title">Crocin MAX<\/h1>/);
    expect(detailMarkup).toMatch(
      /<h2[^>]+id="core-label-heading-0">Core Label Content<\/h2>/,
    );
    expect(detailMarkup).toMatch(
      /<h2[^>]+id="safety-heading-0">[\s\S]*Safety Fields[\s\S]*<\/h2>/,
    );
    expect(detailMarkup).toContain('aria-labelledby="core-label-heading-0"');
    expect(detailMarkup).toContain('aria-labelledby="safety-heading-0"');

    const marketStart = detailMarkup.indexOf("OpenFDA Market Provenance");
    const safetyStart = detailMarkup.indexOf("Safety Fields");
    expect(marketStart).toBeGreaterThanOrEqual(0);
    expect(safetyStart).toBeGreaterThan(marketStart);
  });

  it("surfaces a material route and dosage Source Conflict without correcting either value", async () => {
    const originalRecord = crocinFixture.results[0];
    const conflictMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          dosage_and_administration: ["Take 2 tablets by mouth every 6 hours."],
          openfda: {
            ...originalRecord.openfda,
            route: ["TOPICAL"],
          },
        },
      ],
    });

    expect(conflictMarkup).toContain("Material Source Conflict");
    expect(conflictMarkup).toContain("route metadata lists Topical");
    expect(conflictMarkup).toContain("dosage text mentions solid oral dosage instructions");
    expect(conflictMarkup).toContain("Topical");
    expect(conflictMarkup).toContain("Take 2 tablets by mouth every 6 hours.");

    const oralOnlyConflictMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          dosage_and_administration: ["Take by mouth every 6 hours."],
          dosage_and_administration_table: [],
          openfda: {
            ...originalRecord.openfda,
            route: ["TOPICAL"],
          },
        },
      ],
    });

    expect(oralOnlyConflictMarkup).toContain("oral dosage instructions");

    const negatedInstructionMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          dosage_and_administration: ["Do not take by mouth. Apply to skin."],
          dosage_and_administration_table: [],
          openfda: {
            ...originalRecord.openfda,
            route: ["TOPICAL"],
          },
        },
      ],
    });

    expect(negatedInstructionMarkup).not.toContain("Material Source Conflict");

    const ophthalmicConflictMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          dosage_and_administration: ["Take 2 tablets by mouth."],
          dosage_and_administration_table: [],
          openfda: {
            ...originalRecord.openfda,
            route: ["OPHTHALMIC"],
          },
        },
      ],
    });

    expect(ophthalmicConflictMarkup).toContain("Material Source Conflict");
  });

  it("keeps identifier discrepancies out of user-facing clinical warnings", async () => {
    const originalRecord = crocinFixture.results[0];
    const detailMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          openfda: {
            ...originalRecord.openfda,
            spl_set_id: ["diagnostic-only-set-id"],
          },
        },
      ],
    });

    expect(detailMarkup).toContain("SPL Set Provenance");
    expect(detailMarkup).toContain("diagnostic-only-set-id");
    expect(detailMarkup).not.toContain("Material Source Conflict");
    expect(detailMarkup).not.toContain('class="source-conflict-caveat"');
    expect(detailMarkup).not.toContain('role="alert"');
  });

  it("shows separate Products and makes a partial Result Window explicit", async () => {
    const firstRecord = crocinFixture.results[0];
    const secondSetId = "second-product";
    const secondRecord = {
      ...firstRecord,
      set_id: secondSetId,
      openfda: {
        ...firstRecord.openfda,
        brand_name: ["Crocin Alternative"],
      },
    };
    const fixture = {
      ...crocinFixture,
      meta: {
        ...crocinFixture.meta,
        results: { total: 25, limit: 2, skip: 0 },
      },
      results: [firstRecord, secondRecord],
    };

    mockProductFixture(fixture);

    const home = await Home({
      searchParams: Promise.resolve({ term: "Crocin" }),
    });
    const markup = renderToStaticMarkup(home);

    expect(markup).toContain("Crocin MAX");
    expect(markup).toContain("Crocin Alternative");
    expect(markup).toContain("Showing 2 unique Products from 25 Result Set entries");
    expect(markup).toContain("Partial Result Window");
    expect(markup).toContain("Window limit 2 | offset 0");
    expect(markup.match(/class="product-link"/g)).toHaveLength(2);
  });

  it("shows the Search Term in a successful No Matches state", async () => {
    const fixture = {
      ...crocinFixture,
      meta: {
        ...crocinFixture.meta,
        results: { total: 0, limit: 10, skip: 0 },
      },
      results: [],
    };

    mockProductFixture(fixture);

    const home = await Home({
      searchParams: Promise.resolve({ term: "Unknown Brand" }),
    });
    const markup = renderToStaticMarkup(home);

    expect(markup).toContain("No Matches");
    expect(markup).toContain("No Products matched");
    expect(markup).toContain("Unknown Brand");
  });

  it("shows a friendly no-match state for openFDA's explicit 404 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "NOT_FOUND", message: "No matches found!" },
        }),
        { status: 404 },
      ),
    );

    const home = await Home({
      searchParams: Promise.resolve({ term: "Unknown Brand" }),
    });
    const markup = renderToStaticMarkup(home);

    expect(markup).toContain("No Matches");
    expect(markup).toContain("No medicines matched");
    expect(markup).toContain("Unknown Brand");
    expect(markup).toContain("Check the spelling and try again.");
    expect(markup).not.toContain("API rejected search");
    expect(markup).not.toContain("message-card-error");
  });

  it("excludes unidentifiable records and degrades sparse display fields", async () => {
    const fixture = {
      ...crocinFixture,
      meta: {
        ...crocinFixture.meta,
        results: { total: 2, limit: 10, skip: 0 },
      },
      results: [
        { set_id: "sparse-product" },
        { openfda: { brand_name: ["Unroutable label"] } },
      ],
    };

    mockProductFixture(fixture);

    const home = await Home({
      searchParams: Promise.resolve({ term: "Sparse" }),
    });
    const markup = renderToStaticMarkup(home);

    expect(markup).toContain("Brand alias unavailable");
    expect(markup).toContain("sparse-product");
    expect(markup).not.toContain("Unroutable label");
    expect(markup).not.toContain("undefined");
  });

  it.each([
    {
      name: "a transport failure",
      mock: () => vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed")),
      title: "Search unavailable",
      message: "openFDA could not be reached. Check your connection and retry the search.",
    },
    {
      name: "a timeout",
      mock: () =>
        vi
          .spyOn(globalThis, "fetch")
          .mockRejectedValue(new DOMException("The operation timed out", "TimeoutError")),
      title: "Search timed out",
      message: "The openFDA search timed out. Retry the search.",
    },
    {
      name: "an API rejection",
      mock: () =>
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response("rejected", { status: 503 }),
        ),
      title: "API rejected search",
      message: "openFDA rejected this search request. Review the Search Term and retry.",
    },
    {
      name: "a malformed response",
      mock: () =>
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
          new Response("not json", { status: 200 }),
        ),
      title: "Malformed source response",
      message: "openFDA returned data we could not interpret. Retry later.",
    },
  ])("shows a distinct retry-oriented state for $name", async ({ mock, title, message }) => {
    mock();

    const home = await Home({
      searchParams: Promise.resolve({ term: "Crocin MAX" }),
    });
    const markup = renderToStaticMarkup(home);

    expect(markup).toContain(title);
    expect(markup).toContain(message);
  });

  it("renders a recoverable message when the Product source is unreachable", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));

    const detail = await ProductPage({
      params: Promise.resolve({ setId: productSetId }),
    });
    const detailMarkup = renderToStaticMarkup(detail);

    expect(detailMarkup).toContain("Product unavailable");
    expect(detailMarkup).toContain(
      "openFDA could not be reached. Check your connection and try again.",
    );
  });

  it("renders a retry message when the Product source times out", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new DOMException("The operation timed out", "TimeoutError"),
    );

    const detail = await ProductPage({
      params: Promise.resolve({ setId: productSetId }),
    });
    const detailMarkup = renderToStaticMarkup(detail);

    expect(detailMarkup).toContain("Product unavailable");
    expect(detailMarkup).toContain(
      "The openFDA Product request timed out. Try again later.",
    );
  });

  it("renders complete label content with independent source boundaries", async () => {
    const detailMarkup = await renderProductFixture(crocinFixture);

    expect(detailMarkup).toContain("Active Ingredient Text");
    expect(detailMarkup).toContain("Acetaminophen 650 mg");
    expect(detailMarkup).toContain("Generic Name Metadata");
    expect(detailMarkup).toContain("Substance Name Metadata");
    expect(detailMarkup).toContain("Purpose");
    expect(detailMarkup).toContain("Indications and Usage");
    expect(detailMarkup).toContain("Dosage and Administration");
    expect(detailMarkup).toContain("Warnings");
    expect(detailMarkup).toContain("Do Not Use");
    expect(detailMarkup).toContain("Ask a Doctor");
    expect(detailMarkup).toContain("Ask a Doctor or Pharmacist");
    expect(detailMarkup).toContain("Stop Use");
    expect(detailMarkup).toContain("Pregnancy or Breast-Feeding");
    expect(detailMarkup).toContain("Keep Out of Reach of Children");
    expect(detailMarkup).toContain("Overdosage");
    expect(detailMarkup).toContain("Other Safety Information");
    expect(detailMarkup).toContain("Label contact text printed on this label.");
    expect(detailMarkup).toContain("openFDA SPL ID (Label Document Identifier)");
    expect(detailMarkup).toContain("SPL Set Provenance");
    expect(detailMarkup).toContain("January 29, 2026");
    expect(detailMarkup).toContain("20260129");
    expect(detailMarkup).toContain("<table");
    expect(detailMarkup).toContain("Adults");
  });

  it("keeps repeated source fragments inside their field boundaries", async () => {
    const originalRecord = crocinFixture.results[0];
    const repeatedFixture = {
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          purpose: ["Repeated purpose fragment", "Repeated purpose fragment"],
          indications_and_usage: [
            "Shared source fragment",
            "Shared source fragment",
          ],
        },
      ],
    };

    const detailMarkup = await renderProductFixture(repeatedFixture);
    const purposeStart = detailMarkup.indexOf('data-source-field="purpose"');
    const purposeSection = detailMarkup.slice(
      purposeStart,
      detailMarkup.indexOf("</section>", purposeStart),
    );

    expect(
      detailMarkup.match(/Repeated purpose fragment/g),
    ).toHaveLength(2);
    expect(detailMarkup.match(/Shared source fragment/g)).toHaveLength(2);
    expect(purposeSection.match(/Repeated purpose fragment/g)).toHaveLength(2);
  });

  it("does not turn missing safety sections into reassurance", async () => {
    const originalRecord = crocinFixture.results[0];
    const recordWithoutSafety: Record<string, unknown> = {
      ...originalRecord,
    };

    for (const fieldName of [
      "ask_doctor",
      "ask_doctor_or_pharmacist",
      "do_not_use",
      "keep_out_of_reach_of_children",
      "overdosage",
      "pregnancy_or_breast_feeding",
      "stop_use",
      "warnings",
    ]) {
      delete recordWithoutSafety[fieldName];
    }

    const detailMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [recordWithoutSafety],
    });

    expect(detailMarkup).toContain("Active Ingredient Text");
    expect(detailMarkup).not.toContain("Warnings");
    expect(detailMarkup).not.toContain("No warnings");
    expect(detailMarkup).not.toContain("This product is safe");

    const emptySafetyMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          warnings: [""],
        },
      ],
    });

    expect(emptySafetyMarkup).not.toContain("Warnings");
    expect(emptySafetyMarkup).not.toContain("No warnings");
  });

  it("keeps sparse Products navigable without inventing label content", async () => {
    const sparseSetId = "sparse-product";
    const detailMarkup = await renderProductFixture(
      {
        ...crocinFixture,
        results: [{ set_id: sparseSetId }],
      },
      sparseSetId,
    );

    expect(detailMarkup).toContain("Brand alias unavailable");
    expect(detailMarkup).toContain(sparseSetId);
    expect(detailMarkup).not.toContain("No warnings");
    expect(detailMarkup).not.toContain("No changes");
  });

  it("uses plain dosage text when a rich dosage fragment is malformed", async () => {
    const originalRecord = crocinFixture.results[0];
    const malformedFixture = {
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          dosage_and_administration: ["Plain dosage fallback"],
          dosage_and_administration_table: ["<table><tr><td>Unclosed"],
        },
      ],
    };

    const detailMarkup = await renderProductFixture(malformedFixture);

    expect(detailMarkup).toContain("Plain dosage fallback");
    expect(detailMarkup).toContain("&lt;table&gt;&lt;tr&gt;&lt;td&gt;Unclosed");
    expect(detailMarkup).not.toContain("<table");
  });

  it("retains a raw rich dosage fragment when plain dosage is absent", async () => {
    const originalRecord = crocinFixture.results[0];
    const recordWithoutDosage: Record<string, unknown> = {
      ...originalRecord,
    };
    delete recordWithoutDosage.dosage_and_administration;
    const malformedFixture = {
      ...crocinFixture,
      results: [
        {
          ...recordWithoutDosage,
          dosage_and_administration_table: ["<table><script>alert(1)</script>"],
        },
      ],
    };

    const detailMarkup = await renderProductFixture(malformedFixture);

    expect(detailMarkup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(detailMarkup).not.toContain("<script>");
    expect(detailMarkup).not.toContain("<table");
  });

  it("keeps storage and other source artifacts separate from core sections", async () => {
    const detailMarkup = await renderProductFixture(
      tylenolFixture,
      "015a6179-bacb-452d-b594-4de628ddc11d",
    );

    expect(detailMarkup).toContain("Storage and Handling");
    expect(detailMarkup).toContain("SPL Unclassified Section");
    expect(detailMarkup).toContain("Supporting Label Artifacts");
    expect(detailMarkup).toContain("Label Contact Text");
    expect(detailMarkup).not.toContain("No changes");
  });

  it("selects the latest valid label revision without hiding tied revisions", async () => {
    const originalRecord = crocinFixture.results[0];
    const olderRevision = {
      ...originalRecord,
      active_ingredient: ["Older revision ingredient"],
      effective_time: "20240101",
      id: "older-label",
    };
    const currentRevision = {
      ...originalRecord,
      active_ingredient: ["Current revision ingredient"],
      effective_time: "20260129",
      id: "current-label",
    };
    const tiedRevision = {
      ...originalRecord,
      active_ingredient: ["Tied revision ingredient"],
      effective_time: "20260129",
      id: "tied-label",
    };

    const latestMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [olderRevision, currentRevision],
    });

    expect(latestMarkup).toContain("Current revision ingredient");
    expect(latestMarkup).not.toContain("Older revision ingredient");

    const tiedMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [currentRevision, tiedRevision],
    });

    expect(tiedMarkup).toContain("Current revision ingredient");
    expect(tiedMarkup).toContain("Tied revision ingredient");
    expect(tiedMarkup).toContain("Co-preferred Label Revision 2");

    const malformedDateMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          effective_time: "not-a-date",
        },
      ],
    });

    expect(malformedDateMarkup).toContain("not-a-date");
    expect(malformedDateMarkup).not.toContain("Invalid Date");

    const ambiguousMarkup = await renderProductFixture({
      ...crocinFixture,
      results: [
        {
          ...originalRecord,
          active_ingredient: ["Ambiguous revision one"],
          effective_time: "not-a-date",
          id: "ambiguous-one",
        },
        {
          ...originalRecord,
          active_ingredient: ["Ambiguous revision two"],
          effective_time: "also-not-a-date",
          id: "ambiguous-two",
        },
      ],
    });

    expect(ambiguousMarkup).toContain("Ambiguous revision one");
    expect(ambiguousMarkup).toContain("Ambiguous revision two");
    expect(ambiguousMarkup).toContain("Ambiguous Label Revision 2");
  });
});
