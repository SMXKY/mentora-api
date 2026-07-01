import { PermissionService } from "./permission.service";
import { PermissionRepository } from "./permission.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./permission.repository");

const mockRepo = PermissionRepository as jest.Mocked<typeof PermissionRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("PermissionService", () => {
  let service: PermissionService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermissionService();
  });

  describe("create", () => {
    it("should create a permission successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a permission by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when permission not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a permission", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a permission", async () => {
      // TODO: implement
    });

    it("should hard delete a permission when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted permission", async () => {
      // TODO: implement
    });
  });
});
