export class Query<T> {
  private queryObj: Record<string, any>;
  private whereClause: Record<string, any> = {};
  private orderBy: Record<string, "asc" | "desc">[] = [];
  private selectFields: Record<string, boolean> | undefined;
  private skipValue: number = 0;
  private takeValue: number | undefined;

  constructor(queryObj: object) {
    this.queryObj = { ...queryObj };
  }

  public filter() {
    const obj = { ...this.queryObj };
    const excludedFields = ["fields", "sort", "page", "limit"];
    excludedFields.forEach((key) => delete obj[key]);

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        const prismaCondition: Record<string, any> = {};

        for (const [op, val] of Object.entries(value)) {
          const operatorMap: Record<string, string> = {
            gt: "gt",
            gte: "gte",
            lt: "lt",
            lte: "lte",
            ne: "not",
            in: "in",
            nin: "notIn",
          };

          if (operatorMap[op]) {
            prismaCondition[operatorMap[op]] = val;
          }
        }

        this.whereClause[key] = prismaCondition;
      } else {
        this.whereClause[key] = value;
      }
    }

    return this;
  }

  public sort(defaultSort: string = "-createdAt") {
    const sortStr = (this.queryObj["sort"] as string) || defaultSort;

    this.orderBy = sortStr.split(",").map((field) => {
      if (field.startsWith("-")) {
        return { [field.slice(1)]: "desc" as const };
      }
      return { [field]: "asc" as const };
    });

    return this;
  }

  public limitFields() {
    if (this.queryObj["fields"]) {
      const fields = (this.queryObj["fields"] as string).split(",");
      this.selectFields = fields.reduce((acc, field) => {
        acc[field.trim()] = true;
        return acc;
      }, {} as Record<string, boolean>);
    }
    return this;
  }

  public paginate(defaultPage: number = 1, defaultLimit: number = 10) {
    const page = parseInt(this.queryObj["page"]) || defaultPage;
    const rawLimit = parseInt(this.queryObj["limit"]) || defaultLimit;
    const maxLimit = Number(process.env.MAX_PAGE_SIZE) || 100;
    const limit = Math.min(rawLimit, maxLimit);

    this.skipValue = (page - 1) * limit;
    this.takeValue = limit;

    return this;
  }

  public getQuery() {
    return {
      where: this.whereClause,
      orderBy: this.orderBy.length ? this.orderBy : undefined,
      select: this.selectFields,
      skip: this.skipValue,
      take: this.takeValue,
    };
  }
}
