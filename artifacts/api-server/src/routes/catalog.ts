import {
  GetCatalogCategoriesResponse,
  GetCatalogProductsQueryParams,
  GetCatalogProductsResponse,
} from "@workspace/api-zod";
import { Router, type IRouter, type Request, type Response } from "express";
import { getFilteredCatalog } from "../catalog/filtered-catalog";
import {
  CatalogNotConfiguredError,
  getLightspeedCategories,
  LightspeedRequestError,
} from "../catalog/lightspeed";

const router: IRouter = Router();

router.get("/catalog/categories", async (req, res): Promise<void> => {
  try {
    const categories = await getLightspeedCategories();
    res.json(GetCatalogCategoriesResponse.parse(categories));
  } catch (error) {
    sendCatalogError(req, res, error);
  }
});

router.get("/catalog/products", async (req, res): Promise<void> => {
  const query = GetCatalogProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "The catalog query is invalid." });
    return;
  }
  if (
    query.data.minPrice !== undefined &&
    query.data.maxPrice !== undefined &&
    query.data.minPrice > query.data.maxPrice
  ) {
    res.status(400).json({ error: "Minimum price cannot exceed maximum price." });
    return;
  }

  let filters: Record<string, string>;
  try {
    const parsed: unknown = JSON.parse(query.data.filters || "{}");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      Array.isArray(parsed) ||
      Object.keys(parsed).length > 30 ||
      Object.values(parsed).some(
        (value) => typeof value !== "string" || !value || value.length > 200,
      )
    ) {
      throw new Error("Invalid filter values");
    }
    filters = parsed as Record<string, string>;
  } catch {
    res.status(400).json({ error: "The catalog filters are invalid." });
    return;
  }

  try {
    const page = await getFilteredCatalog(
      query.data.q,
      filters,
      query.data.limit,
      query.data.offset,
      { minPrice: query.data.minPrice, maxPrice: query.data.maxPrice },
    );
    res.json(GetCatalogProductsResponse.parse(page));
  } catch (error) {
    sendCatalogError(req, res, error);
  }
});

function sendCatalogError(req: Request, res: Response, error: unknown): void {
  if (error instanceof CatalogNotConfiguredError) {
    res.status(503).json({
      error:
        "The Lightspeed catalog is not configured. Set VITE_LIGHTSPEED_STORE_ID and LIGHTSPEED_API_TOKEN on the API server.",
    });
    return;
  }
  if (error instanceof LightspeedRequestError) {
    req.log.warn(
      { upstreamStatus: error.upstreamStatus },
      "Lightspeed catalog request failed",
    );
    if (error.upstreamStatus === 401 || error.upstreamStatus === 403) {
      res.status(502).json({
        error:
          "Lightspeed denied catalog access. Check that the API token belongs to this store and has read_catalog permission.",
      });
      return;
    }
    res.status(502).json({
      error: "The online catalog is temporarily unavailable. Please try again.",
    });
    return;
  }
  req.log.error({ err: error }, "Catalog response could not be processed");
  res.status(502).json({ error: "The online catalog could not be processed." });
}

export default router;
