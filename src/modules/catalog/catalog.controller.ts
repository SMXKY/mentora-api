import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync.util";
import { appResponder } from "../../utils/appResponder.util";
import { StatusCodes } from "http-status-codes";
import prisma from "../../config/database.config";
import { SchoolType } from "../../generated/prisma";

// Reference/taxonomy tables are small and public — no auth, no pagination,
// just a light optional filter per resource.
const MAX_ROWS = 1000;

export const catalogController = {
  listRegions: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    appResponder(StatusCodes.OK, regions, res);
  }),

  listCities: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { regionId } = req.query as { regionId?: string };
    const cities = await prisma.city.findMany({
      where: { isActive: true, ...(regionId && { regionId }) },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    appResponder(StatusCodes.OK, cities, res);
  }),

  listSubjects: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { domainId, search } = req.query as { domainId?: string; search?: string };
    const subjects = await prisma.subject.findMany({
      where: {
        isActive: true,
        ...(domainId && { domainId }),
        ...(search && { name: { contains: search, mode: "insensitive" } }),
      },
      include: { domain: true },
      orderBy: { name: "asc" },
      take: MAX_ROWS,
    });
    appResponder(StatusCodes.OK, subjects, res);
  }),

  listLevels: catchAsync(async (req: Request, res: Response): Promise<void> => {
    const { schoolType } = req.query as { schoolType?: SchoolType };
    const levels = await prisma.level.findMany({
      where: { isActive: true, ...(schoolType && { schoolType }) },
      orderBy: { orderIndex: "asc" },
      take: MAX_ROWS,
    });
    appResponder(StatusCodes.OK, levels, res);
  }),
};

export default catalogController;
