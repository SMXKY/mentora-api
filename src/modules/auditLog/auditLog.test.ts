import { AuditLogService } from "./auditLog.service";
import { AuditLogRepository } from "./auditLog.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./auditLog.repository");

const mockRepo = AuditLogRepository as jest.Mocked<typeof AuditLogRepository>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("AuditLogService", () => {
  let service: AuditLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuditLogService();
  });

  describe("create", () => {
    it("should create a auditLog successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a auditLog by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when auditLog not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a auditLog", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a auditLog", async () => {
      // TODO: implement
    });

    it("should hard delete a auditLog when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted auditLog", async () => {
      // TODO: implement
    });
  });
});
