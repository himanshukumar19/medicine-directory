import crocinFixture from "../../research/api-sample-crocin.json";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import ProductPage from "./products/[setId]/page";

const productSetId = "498c7d7e-d952-c122-e063-6394a90ae72f";

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
});
