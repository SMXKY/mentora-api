import { RoleService } from "./role.service";
import { RoleRepository } from "./role.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./role.repository");

const mockRepo = RoleRepository as jest.Mocked<typeof RoleRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("RoleService", () => {
  let service: RoleService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RoleService();
  });

  describe("create", () => {
    it("should create a role successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a role by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when role not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a role", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a role", async () => {
      // TODO: implement
    });

    it("should hard delete a role when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted role", async () => {
      // TODO: implement
    });
  });
});
