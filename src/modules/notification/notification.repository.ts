import { BaseRepository } from "../../base/BaseRepository";
import { Notification } from "../../generated/prisma";
import {
  OffsetFindOptions,
  OffsetPaginatedResult,
  CursorFindOptions,
  CursorPaginatedResult,
} from "../../base/base.types";

export class NotificationRepository extends BaseRepository<Notification> {
  protected modelName = "notification";
  protected searchableFields: string[] = []; // bodies are template-rendered, not free text — nothing meaningful to search
  protected softDeleteConfig = { enabled: true, uniqueFields: [] };

  async findManyForUser(
    recipientId: string,
    options: OffsetFindOptions & { status?: "read" | "unread" | "all" } = {}
  ): Promise<OffsetPaginatedResult<Notification>> {
    const { status = "all", ...rest } = options;
    const readFilter =
      status === "unread"
        ? { readAt: null }
        : status === "read"
        ? { readAt: { not: null } }
        : {};

    const scopedFilters = { ...rest.filters, recipientId, ...readFilter };
    return this.findMany({ ...rest, filters: scopedFilters });
  }

  async findManyCursorForUser(
    recipientId: string,
    options: CursorFindOptions & { status?: "read" | "unread" | "all" } = {}
  ): Promise<CursorPaginatedResult<Notification>> {
    const { status = "all", ...rest } = options;
    const readFilter =
      status === "unread"
        ? { readAt: null }
        : status === "read"
        ? { readAt: { not: null } }
        : {};

    const scopedFilters = { ...rest.filters, recipientId, ...readFilter };
    return this.findManyCursor({ ...rest, filters: scopedFilters });
  }

  async countUnread(recipientId: string): Promise<number> {
    return this.count({ recipientId, readAt: null } as Partial<Notification>);
  }

  async findOwnedByIdOrThrow(
    id: string,
    recipientId: string
  ): Promise<Notification> {
    return this.model.findFirstOrThrow({
      where: { id, recipientId, deletedAt: null },
    });
  }

  async markAsRead(id: string, recipientId: string): Promise<Notification> {
    await this.findOwnedByIdOrThrow(id, recipientId);
    return this.model.update({
      where: { id },
      data: { readAt: new Date() },
    });
  }

  async markAllAsRead(recipientId: string): Promise<number> {
    const result = await this.model.updateMany({
      where: { recipientId, readAt: null, deletedAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  /** Dismissal is a per-recipient soft delete — the notification itself isn't touched for anyone else. */
  async dismiss(id: string, recipientId: string): Promise<Notification> {
    await this.findOwnedByIdOrThrow(id, recipientId);
    return this.model.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async dismissMany(ids: string[], recipientId: string): Promise<number> {
    const result = await this.model.updateMany({
      where: { id: { in: ids }, recipientId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return result.count;
  }
}
