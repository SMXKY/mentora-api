import { UserService } from "./user.service";
import { UserRepository } from "./user.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./user.repository");

const mockRepo = UserRepository as jest.Mocked<typeof UserRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("UserService", () => {
  let service: UserService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserService();
  });

  describe("create", () => {
    it("should create a user successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a user by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when user not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a user", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a user", async () => {
      // TODO: implement
    });

    it("should hard delete a user when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted user", async () => {
      // TODO: implement
    });
  });
});
