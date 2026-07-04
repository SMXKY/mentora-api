import { BaseService } from "../../base/BaseService";
import { NotificationRepository } from "./notification.repository";
import { ServiceContext } from "../../base/base.types";
import { CreateNotificationInput, UpdateNotificationInput } from "./notification.types";


export class NotificationService extends BaseService<
  any,
  CreateNotificationInput,
  UpdateNotificationInput
> {
  protected repository = new NotificationRepository();
  protected tableName = "notification";


  // ============================================================
  // LIFECYCLE HOOKS
  // Uncomment and implement as needed
  // ============================================================

  // protected async beforeCreate(data: CreateNotificationInput, ctx: ServiceContext) {
  //   // Enrich or validate data before insert
  //   // e.g. hash a password, generate a reference number
  //   return data
  // }

  // protected async afterCreate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful insert
  //   // e.g. send notification, update a counter
  // }

  // protected async beforeUpdate(id: string, data: UpdateNotificationInput, ctx: ServiceContext) {
  //   // Modify data before update
  //   // e.g. strip fields the user should not change
  //   return data
  // }

  // protected async afterUpdate(record: any, ctx: ServiceContext) {
  //   // Side effects after successful update
  // }

  // protected async beforeDelete(id: string, ctx: ServiceContext) {
  //   // Run checks before deletion
  //   // e.g. check no active bookings exist before deleting a tutor
  // }

  // protected async afterDelete(record: any, ctx: ServiceContext) {
  //   // Side effects after deletion
  //   // e.g. release associated escrow, cancel scheduled jobs
  // }

  // ============================================================
  // CUSTOM METHODS
  // Add business logic methods here beyond standard CRUD
  // ============================================================
}
