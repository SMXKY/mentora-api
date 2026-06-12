import { UserRoleService } from "./userRole.service";
import { UserRoleRepository } from "./userRole.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./userRole.repository");

const mockRepo = UserRoleRepository as jest.Mocked<typeof UserRoleRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("UserRoleService", () => {
  let service: UserRoleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserRoleService();
  });

  describe("create", () => {
    it("should create a userRole successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a userRole by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when userRole not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a userRole", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a userRole", async () => {
      // TODO: implement
    });

    it("should hard delete a userRole when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted userRole", async () => {
      // TODO: implement
    });
  });
});
