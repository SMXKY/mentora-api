import { AuthService } from "./auth.service";
import prisma from "../../config/database.config";
import { AppError } from "../../utils/AppError.util";
import { Languages, WalletType } from "../../generated/prisma";

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockedPrisma = prisma as jest.Mocked<typeof prisma>;

const mockCtx = {
  userId: "clerk_user_123",
  userEmail: undefined,
  requestId: "req-123",
  ipAddress: "127.0.0.1",
  userAgent: "jest",
  lang: Languages.EN,
};

describe("AuthService.completeRegistration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("rejects roles outside Parent/Student/Tutor", async () => {
    await expect(
      AuthService.completeRegistration({ role: "Admin" as any }, mockCtx, {
        email: "test@example.com",
      })
    ).rejects.toThrow(AppError);
  });

  it("throws 409 if a local User already exists for this Clerk account", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "existing-user-id",
    });

    await expect(
      AuthService.completeRegistration({ role: "Parent" }, mockCtx, {
        email: "test@example.com",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("throws 400 if Clerk session has no email claim", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      AuthService.completeRegistration({ role: "Parent" }, mockCtx, {})
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 500 if the Role row is missing (seed not run)", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.role.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      AuthService.completeRegistration({ role: "Parent" }, mockCtx, {
        email: "test@example.com",
      })
    ).rejects.toMatchObject({ statusCode: 500 });
  });

  it("creates User, Wallet, and UserRole in a transaction for a valid Parent registration", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    (mockedPrisma.role.findUnique as jest.Mock).mockResolvedValue({
      id: "role-parent-id",
      name: "Parent",
    });

    const createdUser = {
      id: "new-user-id",
      clerkId: "clerk_user_123",
      email: "test@example.com",
      isEmailVerified: true,
      preferredLanguage: Languages.EN,
    };

    const txMock = {
      user: { create: jest.fn().mockResolvedValue(createdUser) },
      wallet: { create: jest.fn().mockResolvedValue({}) },
      userRole: { create: jest.fn().mockResolvedValue({}) },
    };

    (mockedPrisma.$transaction as jest.Mock).mockImplementation(
      async (fn: any) => fn(txMock)
    );

    const result = await AuthService.completeRegistration(
      { role: "Parent" },
      mockCtx,
      { email: "test@example.com", email_verified: true }
    );

    expect(result).toEqual(createdUser);
    expect(txMock.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clerkId: "clerk_user_123",
          email: "test@example.com",
          isEmailVerified: true,
        }),
      })
    );
    expect(txMock.wallet.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "new-user-id",
          walletType: WalletType.PARENT,
          balanceXaf: 0,
        }),
      })
    );
    expect(txMock.userRole.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "new-user-id",
          roleId: "role-parent-id",
          createdById: "new-user-id",
        }),
      })
    );
  });
});

describe("AuthService.getSessionStatus", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns needs_registration when no local User exists", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await AuthService.getSessionStatus(mockCtx);

    expect(result).toEqual({ status: "needs_registration" });
  });

  it("returns needs_registration when User exists but has no active role", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-id",
      deletedAt: null,
      userRoles: [],
    });

    const result = await AuthService.getSessionStatus(mockCtx);

    expect(result).toEqual({ status: "needs_registration" });
  });

  it("returns ready with user data when User has an active role", async () => {
    (mockedPrisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: "user-id",
      email: "test@example.com",
      firstName: "Jane",
      lastName: "Doe",
      isEmailVerified: true,
      isAccountComplete: false,
      preferredLanguage: Languages.EN,
      deletedAt: null,
      userRoles: [{ role: { name: "Parent" } }],
    });

    const result = await AuthService.getSessionStatus(mockCtx);

    expect(result).toEqual({
      status: "ready",
      user: {
        id: "user-id",
        email: "test@example.com",
        firstName: "Jane",
        lastName: "Doe",
        isEmailVerified: true,
        isAccountComplete: false,
        preferredLanguage: Languages.EN,
        role: "Parent",
      },
    });
  });
});
