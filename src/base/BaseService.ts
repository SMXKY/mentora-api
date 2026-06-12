import { AuditService } from "../utils/logUserActivity.util";
import { BaseRepository } from "./BaseRepository";
import {
  ServiceContext,
  OffsetFindOptions,
  CursorFindOptions,
  OffsetPaginatedResult,
  CursorPaginatedResult,
  AuditLogOptions,
  AuditOperation,
  AuditCategory,
} from "./base.types";

export abstract class BaseService<
  T,
  CreateDTO = Partial<T>,
  UpdateDTO = Partial<T>
> {
  protected abstract repository: BaseRepository<T>;
  protected abstract tableName: string;

  // ============================================================
  // LIFECYCLE HOOKS
  // Override these in concrete services to add behaviour
  // around the core CRUD operations without modifying the
  // base method.
  //
  // beforeCreate: modify or enrich data before insert
  //               e.g. hash a password, generate a reference number
  // afterCreate:  trigger side effects after successful insert
  //               e.g. send a welcome notification, update a counter
  // beforeUpdate: modify data before update
  //               e.g. strip fields the user should not be able to change
  // afterUpdate:  trigger side effects after successful update
  // beforeDelete: run checks before deletion
  //               e.g. check no active bookings exist before deleting a tutor
  // afterDelete:  trigger side effects after successful deletion
  //               e.g. release associated escrow, cancel scheduled jobs
  // ============================================================

  protected async beforeCreate(
    data: CreateDTO,
    ctx: ServiceContext
  ): Promise<CreateDTO> {
    return data;
  }

  protected async afterCreate(record: T, ctx: ServiceContext): Promise<void> {}

  protected async beforeUpdate(
    id: string,
    data: UpdateDTO,
    ctx: ServiceContext
  ): Promise<UpdateDTO> {
    return data;
  }

  protected async afterUpdate(record: T, ctx: ServiceContext): Promise<void> {}

  protected async beforeDelete(
    id: string,
    ctx: ServiceContext
  ): Promise<void> {}

  protected async afterDelete(record: T, ctx: ServiceContext): Promise<void> {}

  async create(data: CreateDTO, ctx: ServiceContext): Promise<T> {
    const processedData = await this.beforeCreate(data, ctx);

    const record = await this.repository.transaction(async (tx) => {
      return this.repository.create(processedData as Partial<T>);
    });

    this.log(ctx, {
      operation: "CREATE",
      category: "WRITE",
      recordId: (record as any).id,
      newState: record as Record<string, any>,
    });

    await this.afterCreate(record, ctx);

    return record;
  }

  async findById(
    id: string,
    ctx: ServiceContext,
    include?: Record<string, boolean | object>
  ): Promise<T> {
    const record = await this.repository.findByIdOrThrow(id, include);
    return record;
  }

  async findMany(
    options: OffsetFindOptions,
    ctx: ServiceContext
  ): Promise<OffsetPaginatedResult<T>> {
    return this.repository.findMany(options);
  }

  async findManyCursor(
    options: CursorFindOptions,
    ctx: ServiceContext
  ): Promise<CursorPaginatedResult<T>> {
    return this.repository.findManyCursor(options);
  }

  async update(id: string, data: UpdateDTO, ctx: ServiceContext): Promise<T> {
    const previousState = await this.repository.findByIdOrThrow(id);

    const processedData = await this.beforeUpdate(id, data, ctx);

    const record = await this.repository.transaction(async (tx) => {
      return this.repository.update(id, processedData as Partial<T>);
    });

    this.log(ctx, {
      operation: "UPDATE",
      category: "WRITE",
      recordId: id,
      previousState: previousState as Record<string, any>,
      newState: record as Record<string, any>,
      changedFields: this.getChangedFields(
        previousState as Record<string, any>,
        record as Record<string, any>
      ),
    });

    await this.afterUpdate(record, ctx);

    return record;
  }

  async delete(
    id: string,
    ctx: ServiceContext,
    soft: boolean = true
  ): Promise<T> {
    await this.beforeDelete(id, ctx);

    const previousState = await this.repository.findByIdOrThrow(id);

    const record = await this.repository.transaction(async (tx) => {
      return soft ? this.repository.softDelete(id) : this.repository.delete(id);
    });

    this.log(ctx, {
      operation: "DELETE",
      category: "WRITE",
      recordId: id,
      previousState: previousState as Record<string, any>,
    });

    await this.afterDelete(record, ctx);

    return record;
  }

  async restore(id: string, ctx: ServiceContext): Promise<T> {
    const record = await this.repository.restore(id);

    this.log(ctx, {
      operation: "RESTORE",
      category: "WRITE",
      recordId: id,
      newState: record as Record<string, any>,
      changedFields: ["deletedAt"],
    });

    return record;
  }

  async findDeleted(
    options: OffsetFindOptions,
    ctx: ServiceContext
  ): Promise<OffsetPaginatedResult<T>> {
    return this.repository.findDeleted(options);
  }

  async findDeletedById(
    id: string,
    ctx: ServiceContext,
    include?: Record<string, boolean | object>
  ): Promise<T> {
    return this.repository.findDeletedByIdOrThrow(id, include);
  }

  protected log(ctx: ServiceContext, options: AuditLogOptions): void {
    AuditService.record(ctx, this.tableName, options);
  }

  protected getChangedFields(
    previous: Record<string, any>,
    current: Record<string, any>
  ): string[] {
    const systemFields = ["createdAt", "updatedAt", "deletedAt"];
    const changed: string[] = [];

    for (const key of Object.keys(current)) {
      if (systemFields.includes(key)) continue;
      if (JSON.stringify(previous[key]) !== JSON.stringify(current[key])) {
        changed.push(key);
      }
    }

    return changed;
  }
}
