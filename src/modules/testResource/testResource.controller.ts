import { BaseController } from "../../base/BaseController";
import { TestResourceService } from "./testResource.service";

// ============================================================
// TESTRESOURCE CONTROLLER
// Inherits: create, findById, findMany, search, update,
//           delete, restore, findDeleted, findDeletedById
//
// Override any method to customise behaviour for this module.
// Add custom handlers below for non-standard operations.
// ============================================================

export class TestResourceController extends BaseController<any> {
  protected service = new TestResourceService();

  // Example override:
  // create = catchAsync(async (req, res) => {
  //   const ctx = buildContext(req, res)
  //   const result = await this.service.createWithCustomLogic(req.body, ctx)
  //   appResponder(201, result, res)
  // })
}

export const testResourceController = new TestResourceController();
