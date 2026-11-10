import { GetCatalogProductsQueryParams } from "@workspace/api-zod";
import { GetCatalogProductsResponse } from "@workspace/api-zod";
import { Router, type IRouter } from "express";
import {
  CatalogNotConfiguredError,
  getLightspeedProducts,
  LightspeedRequestError,
} from "../catalog/lightspeed";

const router: IRouter = Router();

router.get("/catalog/products", async (req, res) => {
  const query = GetCatalogProductsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: "The catalog query is invalid." });
    return;
  }

  try {
    const page = await getLightspeedProducts({
      query: query.data.q,
      limit: query.data.limit,
      offset: query.data.offset,
    });
    res.json(GetCatalogProductsResponse.parse(page));
  } catch (error) {
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
      res.status(502).json({
        error: "The online catalog is temporarily unavailable. Please try again.",
      });
      return;
    }
    req.log.error({ err: error }, "Catalog response could not be processed");
    res.status(502).json({ error: "The online catalog could not be processed." });
  }
});

export default router;
