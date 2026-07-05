import { Router } from "express";
import { catalogController } from "./catalog.controller";
import { validate } from "../../middlewares/validate.middleware";
import { ListCitiesQuery, ListSubjectsQuery, ListLevelsQuery } from "./catalog.schema";

// Public reference/taxonomy data — no auth required. Split into four
// routers mounted at their own flat top-level paths (not nested under a
// shared /catalog prefix) to match the rest of this API's convention of
// one resource per path segment.

export const regionsRouter = Router();
regionsRouter.get("/", catalogController.listRegions);

export const citiesRouter = Router();
citiesRouter.get("/", validate(ListCitiesQuery, "query"), catalogController.listCities);

export const subjectsRouter = Router();
subjectsRouter.get("/", validate(ListSubjectsQuery, "query"), catalogController.listSubjects);

export const levelsRouter = Router();
levelsRouter.get("/", validate(ListLevelsQuery, "query"), catalogController.listLevels);
