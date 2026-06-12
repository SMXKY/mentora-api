import { BaseController } from "../../base/BaseController";
import { UserService } from "./user.service";

// ============================================================
// USER CONTROLLER
// Inherits: create, findById, findMany, search, update,
//           delete, restore, findDeleted, findDeletedById
//
// Override any method to customise behaviour for this module.
// Add custom handlers below for non-standard operations.
// ============================================================

export class UserController extends BaseController<any> {
  protected service = new UserService();

  // Example override:
  // create = catchAsync(async (req, res) => {
  //   const ctx = buildContext(req, res)
  //   const result = await this.service.createWithCustomLogic(req.body, ctx)
  //   appResponder(201, result, res)
  // })
}

export const userController = new UserController();
