import crocinFixture from "../../research/api-sample-crocin.json";
import tylenolFixture from "../../research/api-sample-tylenol.json";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import ProductPage from "./products/[setId]/page";

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
    expect(homeMarkup).toContain("1 Product");

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
  });
});
