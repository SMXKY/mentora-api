import { TestResourceService } from "./testResource.service";
import { TestResourceRepository } from "./testResource.repository";
import { AppError } from "../../utils/AppError.util";

jest.mock("./testResource.repository");

const mockRepo = TestResourceRepository as jest.Mocked<
  typeof TestResourceRepository
>;

const mockCtx = {
  userId: "user-123",
  userEmail: "test@example.com",
  requestId: "req-123",
};

describe("TestResourceService", () => {
  let service: TestResourceService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestResourceService();
  });

  describe("create", () => {
    it("should create a testResource successfully", async () => {
      // TODO: implement
      // const mockData = { name: "Test" }
      // const mockRecord = { id: "uuid", ...mockData, createdAt: new Date(), updatedAt: new Date() }
      // jest.spyOn(service["repository"], "create").mockResolvedValue(mockRecord)
      // const result = await service.create(mockData, mockCtx)
      // expect(result).toEqual(mockRecord)
    });
  });

  describe("findById", () => {
    it("should return a testResource by id", async () => {
      // TODO: implement
    });

    it("should throw AppError 404 when testResource not found", async () => {
      // TODO: implement
      // jest.spyOn(service["repository"], "findByIdOrThrow").mockRejectedValue(new AppError("error.db.not_found", 404))
      // await expect(service.findById("bad-id", mockCtx)).rejects.toThrow(AppError)
    });
  });

  describe("update", () => {
    it("should update a testResource", async () => {
      // TODO: implement
    });
  });

  describe("delete", () => {
    it("should soft delete a testResource", async () => {
      // TODO: implement
    });

    it("should hard delete a testResource when soft=false", async () => {
      // TODO: implement
    });
  });

  describe("restore", () => {
    it("should restore a soft deleted testResource", async () => {
      // TODO: implement
    });
  });
});
