const mockPrisma: any = {
  tutorProfile: { findUnique: jest.fn() },
  booking: { findMany: jest.fn() },
};

jest.mock("../../config/database.config", () => ({
  __esModule: true,
  default: mockPrisma,
}));

import { BookingAccessService } from "./bookingAccess.service";
import { BookingStatus } from "../../generated/prisma";

const TUTOR_USER = "tutor-user-1";
const TUTOR_PROFILE_ID = "tutor-profile-1";
const BOOKER_USER = "booker-user-1";

function mockTutorProfileLookup(tutorUserId: string) {
  mockPrisma.tutorProfile.findUnique.mockImplementation(
    ({ where }: { where: { userId: string } }) =>
      Promise.resolve(
        where.userId === tutorUserId ? { id: TUTOR_PROFILE_ID } : null
      )
  );
}

// sessionDate/sessionStartTime/sessionEndTime are WAT wall-clock values —
// build them from a real instant so the PAID/IN_PROGRESS boundary tests are
// anchored to "now" regardless of when the suite runs.
function bookingAtOffset(status: BookingStatus, startOffsetMs: number, durationMs: number) {
  const startInstant = new Date(Date.now() + startOffsetMs);
  const endInstant = new Date(startInstant.getTime() + durationMs);
  // Reverse watWallClockToInstant's -1h shift: wall-clock minutes = instant + 1h.
  const watMinutes = (d: Date) => new Date(d.getTime() + 60 * 60 * 1000);
  const startWat = watMinutes(startInstant);
  const endWat = watMinutes(endInstant);
  return {
    status,
    sessionDate: new Date(Date.UTC(startWat.getUTCFullYear(), startWat.getUTCMonth(), startWat.getUTCDate())),
    sessionStartTime: new Date(Date.UTC(1970, 0, 1, startWat.getUTCHours(), startWat.getUTCMinutes(), 0)),
    sessionEndTime: new Date(Date.UTC(1970, 0, 1, endWat.getUTCHours(), endWat.getUTCMinutes(), 0)),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BookingAccessService.hasActiveOrUpcomingBookingAccess", () => {
  it("returns false when neither user has a TutorProfile", async () => {
    mockPrisma.tutorProfile.findUnique.mockResolvedValue(null);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(
      "user-a",
      "user-b"
    );

    expect(result).toBe(false);
    expect(mockPrisma.booking.findMany).not.toHaveBeenCalled();
  });

  it("is direction-agnostic: works when the tutor is userIdA", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.IN_PROGRESS, -10 * 60 * 1000, 60 * 60 * 1000),
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(
      TUTOR_USER,
      BOOKER_USER
    );

    expect(result).toBe(true);
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          bookerId: BOOKER_USER,
          tutorProfileId: TUTOR_PROFILE_ID,
          status: { in: [BookingStatus.PAID, BookingStatus.IN_PROGRESS] },
        }),
      })
    );
  });

  it("is direction-agnostic: works when the tutor is userIdB (e.g. a tutor replying to their own student)", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.IN_PROGRESS, -10 * 60 * 1000, 60 * 60 * 1000),
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(
      BOOKER_USER,
      TUTOR_USER
    );

    expect(result).toBe(true);
    expect(mockPrisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ bookerId: BOOKER_USER, tutorProfileId: TUTOR_PROFILE_ID }),
      })
    );
  });

  it("PAID counts when the session start time is still in the future", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.PAID, 60 * 60 * 1000, 60 * 60 * 1000), // starts in 1h
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    expect(result).toBe(true);
  });

  it("PAID does NOT count once the scheduled start time has passed, even with no grace period (time overrides status)", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.PAID, -5 * 60 * 1000, 60 * 60 * 1000), // started 5 min ago, status never flipped
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    expect(result).toBe(false);
  });

  it("IN_PROGRESS counts while now falls within [sessionStart, sessionEnd]", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.IN_PROGRESS, -15 * 60 * 1000, 60 * 60 * 1000), // 15 min into a 1h session
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    expect(result).toBe(true);
  });

  it("IN_PROGRESS does NOT count once the scheduled end time has passed, even with no checkout (time overrides status)", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([
      bookingAtOffset(BookingStatus.IN_PROGRESS, -2 * 60 * 60 * 1000, 60 * 60 * 1000), // started 2h ago, 1h long — long over
    ]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    expect(result).toBe(false);
  });

  it("AWAITING_CONFIRMATION and DISPUTED are excluded from the query entirely, regardless of timing", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([]); // the where-clause itself excludes them

    await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    const callArgs = mockPrisma.booking.findMany.mock.calls[0][0];
    expect(callArgs.where.status).toEqual({ in: [BookingStatus.PAID, BookingStatus.IN_PROGRESS] });
  });

  it("returns false when there are no PAID/IN_PROGRESS bookings at all", async () => {
    mockTutorProfileLookup(TUTOR_USER);
    mockPrisma.booking.findMany.mockResolvedValue([]);

    const result = await BookingAccessService.hasActiveOrUpcomingBookingAccess(BOOKER_USER, TUTOR_USER);

    expect(result).toBe(false);
  });
});
