import { PermissionOverrideService } from "./permissionOverride.service";
import { PermissionOverrideRepository } from "./permissionOverride.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./permissionOverride.repository");

const mockRepo = PermissionOverrideRepository as jest.Mocked<typeof PermissionOverrideRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("PermissionOverrideService", () => {
  let service: PermissionOverrideService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PermissionOverrideService();
  });

  describe("create", () => {
    it("should create a permissionOverride successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a permissionOverride by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when permissionOverride not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a permissionOverride", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a permissionOverride", async () => {
      // TODO: implement
    });

    it("should hard delete a permissionOverride when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted permissionOverride", async () => {
      // TODO: implement
    });
  });
});
