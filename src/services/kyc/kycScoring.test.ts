import {
  scoreSubjectClaim,
  HIGH_CONFIDENCE_THRESHOLD,
  REVIEW_CONFIDENCE_THRESHOLD,
} from "./kycScoring";

describe("scoreSubjectClaim", () => {
  it("returns 0 / new-documentation when no credentials were submitted", () => {
    const result = scoreSubjectClaim([], []);
    expect(result.score).toBe(0);
    expect(result.section).toBe("NEW_DOCUMENTATION_REQUIRED");
    expect(result.matchedCredential).toBeNull();
  });

  it("returns 0 / new-documentation when the credential's (type, field) has never been trained", () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "MSC",
          fieldOfStudy: "Physics",
          confidenceWeight: 90,
        },
      ]
    );
    expect(result.score).toBe(0);
    expect(result.section).toBe("NEW_DOCUMENTATION_REQUIRED");
  });

  it("matches case-insensitively and trims whitespace on fieldOfStudy", () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "  mathematics  " }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: 85,
        },
      ]
    );
    expect(result.score).toBe(85);
    expect(result.matchedCredential).toEqual({
      qualificationType: "BSC",
      fieldOfStudy: "  mathematics  ",
    });
  });

  it(`routes to RECOMMEND_APPROVE at exactly the high-confidence threshold (${HIGH_CONFIDENCE_THRESHOLD})`, () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: HIGH_CONFIDENCE_THRESHOLD,
        },
      ]
    );
    expect(result.section).toBe("RECOMMEND_APPROVE");
  });

  it("routes to RECOMMEND_APPROVE just above the high-confidence threshold", () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: HIGH_CONFIDENCE_THRESHOLD + 1,
        },
      ]
    );
    expect(result.section).toBe("RECOMMEND_APPROVE");
  });

  it("routes to RECOMMEND_REVIEW just below the high-confidence threshold", () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: HIGH_CONFIDENCE_THRESHOLD - 1,
        },
      ]
    );
    expect(result.section).toBe("RECOMMEND_REVIEW");
  });

  it(`routes to RECOMMEND_REVIEW at exactly the review threshold (${REVIEW_CONFIDENCE_THRESHOLD})`, () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: REVIEW_CONFIDENCE_THRESHOLD,
        },
      ]
    );
    expect(result.section).toBe("RECOMMEND_REVIEW");
  });

  it("routes to NEW_DOCUMENTATION_REQUIRED just below the review threshold", () => {
    const result = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: REVIEW_CONFIDENCE_THRESHOLD - 1,
        },
      ]
    );
    expect(result.section).toBe("NEW_DOCUMENTATION_REQUIRED");
  });

  it("picks the strongest match across multiple submitted credentials", () => {
    const result = scoreSubjectClaim(
      [
        { qualificationType: "HND", fieldOfStudy: "Electronics" },
        { qualificationType: "BSC", fieldOfStudy: "Mathematics" },
      ],
      [
        {
          qualificationType: "HND",
          fieldOfStudy: "Electronics",
          confidenceWeight: 30,
        },
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: 92,
        },
      ]
    );
    expect(result.score).toBe(92);
    expect(result.matchedCredential?.qualificationType).toBe("BSC");
  });

  it("clamps an out-of-range weight into 0-100", () => {
    const over = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: 150,
        },
      ]
    );
    expect(over.score).toBe(100);

    const under = scoreSubjectClaim(
      [{ qualificationType: "BSC", fieldOfStudy: "Mathematics" }],
      [
        {
          qualificationType: "BSC",
          fieldOfStudy: "Mathematics",
          confidenceWeight: -20,
        },
      ]
    );
    expect(under.score).toBe(0);
    expect(under.section).toBe("NEW_DOCUMENTATION_REQUIRED");
  });

  it("always returns a non-empty, single-sentence explanation", () => {
    const cases = [
      scoreSubjectClaim([], []),
      scoreSubjectClaim(
        [{ qualificationType: "BSC", fieldOfStudy: "Math" }],
        []
      ),
      scoreSubjectClaim(
        [{ qualificationType: "BSC", fieldOfStudy: "Math" }],
        [{ qualificationType: "BSC", fieldOfStudy: "Math", confidenceWeight: 95 }]
      ),
    ];
    for (const result of cases) {
      expect(result.explanation.length).toBeGreaterThan(0);
      expect(result.explanation.split(". ").length).toBeLessThanOrEqual(2);
    }
  });
});
