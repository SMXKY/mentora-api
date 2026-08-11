import { filterMessage, DEFAULT_INTENT_KEYWORDS } from "./contentFilter";

const KEYWORDS = DEFAULT_INTENT_KEYWORDS.map((k) => k.keyword);

describe("filterMessage — clean messages", () => {
  it("passes ordinary conversation", () => {
    expect(filterMessage("Hi, what time works for you tomorrow?", KEYWORDS).result).toBe("CLEAN");
  });

  it("passes a message mentioning a small number that isn't phone-shaped", () => {
    expect(filterMessage("We covered chapters 1 to 3 today.", KEYWORDS).result).toBe("CLEAN");
  });
});

describe("filterMessage — Layer 1: phone numbers", () => {
  it.each([
    ["+237671234567", "cm_phone_plus237"],
    ["237671234567", "cm_phone_237"],
    ["671234567", "cm_phone_mobile"],
    ["271234567", "cm_phone_landline"],
    ["+14155552671", "intl_phone"],
  ])("blocks %s", (text) => {
    const outcome = filterMessage(`call ${text} please`, KEYWORDS);
    expect(outcome.result).toBe("BLOCKED_PHONE");
    expect(outcome.layer).toBe(1);
  });

  it.each([
    ["67000986", "8-digit number starting 6"],
    ["7123456", "7-digit number starting 7"],
    ["812345678", "9-digit number starting 8 (valid CAMEROON_PHONE_REGEX prefix, previously unmatched)"],
    ["912345678", "9-digit number starting 9 (valid CAMEROON_PHONE_REGEX prefix, previously unmatched)"],
  ])("blocks a short/off-length Cameroon number: %s (%s)", (text) => {
    const outcome = filterMessage(`call ${text} please`, KEYWORDS);
    expect(outcome.result).toBe("BLOCKED_PHONE");
    expect(outcome.layer).toBe(1);
  });
});

describe("filterMessage — Layer 1: URLs and email", () => {
  it("blocks an email address", () => {
    expect(filterMessage("reach me at tutor@example.com", KEYWORDS).result).toBe("BLOCKED_URL");
  });

  it("blocks an http(s) URL", () => {
    expect(filterMessage("check https://example.com/page", KEYWORDS).result).toBe("BLOCKED_URL");
  });

  it("blocks a bare domain", () => {
    expect(filterMessage("visit myclasses.com for notes", KEYWORDS).result).toBe("BLOCKED_URL");
  });

  it("blocks a telegram link", () => {
    expect(filterMessage("join t.me/mychannel", KEYWORDS).result).toBe("BLOCKED_URL");
  });
});

describe("filterMessage — Layer 1: social/WhatsApp links", () => {
  it.each([
    "wa.me/237671234567",
    "chat.whatsapp.com/abc123",
    "facebook.com/myprofile",
    "instagram.com/myprofile",
    "twitter.com/myprofile",
    "x.com/myprofile",
    "linkedin.com/in/myprofile",
    "tiktok.com/@myprofile",
    "snapchat.com/add/myprofile",
  ])("blocks %s as social", (text) => {
    expect(filterMessage(text, KEYWORDS).result).toBe("BLOCKED_SOCIAL");
  });
});

describe("filterMessage — Layer 2: obfuscation", () => {
  it("catches a spaced-out phone number", () => {
    const outcome = filterMessage("my digits are 6 7 1 2 3 4 5 6 7", KEYWORDS);
    expect(outcome.result).toBe("BLOCKED_OBFUSCATED");
    expect(outcome.layer).toBe(2);
  });

  it("catches a dash-separated phone number", () => {
    expect(filterMessage("671-234-567", KEYWORDS).result).toBe("BLOCKED_OBFUSCATED");
  });

  it("catches a dot-separated phone number", () => {
    expect(filterMessage("671.234.567", KEYWORDS).result).toBe("BLOCKED_OBFUSCATED");
  });

  it("catches an underscore-mixed phone number", () => {
    expect(filterMessage("671_234-567", KEYWORDS).result).toBe("BLOCKED_OBFUSCATED");
  });

  it("catches a character-substituted phone number (O for 0, l for 1)", () => {
    // "67l234567" -> reverse l->1 -> "671234567"
    expect(filterMessage("67l234567", KEYWORDS).result).toBe("BLOCKED_OBFUSCATED");
  });

  it("still allows a genuinely clean short numeric mention", () => {
    expect(filterMessage("we have 3 sessions left", KEYWORDS).result).toBe("CLEAN");
  });

  it("catches an email address spaced out around the @ and the dot", () => {
    const outcome = filterMessage("tall @ gmail . com", KEYWORDS);
    expect(outcome.result).toBe("BLOCKED_OBFUSCATED");
    expect(outcome.layer).toBe(2);
    expect(outcome.matchedPattern).toBe("email");
  });

  it("catches a bare domain spaced out around the dot", () => {
    expect(filterMessage("visit myclasses . com for notes", KEYWORDS).result).toBe("BLOCKED_OBFUSCATED");
  });

  it("still allows ordinary text containing stray spaced punctuation", () => {
    expect(filterMessage("We covered chapters 1 . 2 and 1 . 3 today", KEYWORDS).result).toBe("CLEAN");
  });
});

describe("filterMessage — Layer 3: intent keywords", () => {
  it.each(KEYWORDS)("blocks the phrase '%s'", (keyword) => {
    const outcome = filterMessage(`Hey, ${keyword} details`, KEYWORDS);
    expect(outcome.result).toBe("BLOCKED_INTENT_KEYWORD");
    expect(outcome.layer).toBe(3);
  });

  it("is case-insensitive", () => {
    expect(filterMessage("CALL ME ON this number later", KEYWORDS).result).toBe("BLOCKED_INTENT_KEYWORD");
  });

  it("is accent-insensitive for French phrases", () => {
    // "mon numéro" in the seed list, typed without the accent
    expect(filterMessage("mon numero est le suivant", KEYWORDS).result).toBe("BLOCKED_INTENT_KEYWORD");
  });

  it("catches a keyword hidden behind character substitution", () => {
    // "c@ll me on" -> reverse @->a -> "call me on"
    expect(filterMessage("c@ll me on this number", KEYWORDS).result).toBe("BLOCKED_INTENT_KEYWORD");
  });

  it("does not block unrelated messages containing similar but distinct words", () => {
    expect(filterMessage("Can you call the homework 'assignment 1'?", KEYWORDS).result).toBe("CLEAN");
  });
});

describe("filterMessage — layer precedence", () => {
  it("reports Layer 1 phone before Layer 3 keyword when both are present", () => {
    const outcome = filterMessage("call me on 671234567", KEYWORDS);
    expect(outcome.layer).toBe(1);
    expect(outcome.result).toBe("BLOCKED_PHONE");
  });
});
