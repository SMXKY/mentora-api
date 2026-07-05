import { NotificationService } from "./notification.service";
import { NotificationRepository } from "./notification.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./notification.repository");

const mockRepo = NotificationRepository as jest.Mocked<typeof NotificationRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("NotificationService", () => {
  let service: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService();
  });

  describe("create", () => {
    it("should create a notification successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a notification by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when notification not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a notification", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a notification", async () => {
      // TODO: implement
    });

    it("should hard delete a notification when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted notification", async () => {
      // TODO: implement
    });
  });
});
