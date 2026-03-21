import { describe, it, expect } from "vitest";
import { isOrganizer } from "./organizer-utils";

describe("isOrganizer", () => {
  it("returns true for organizerId match", () => {
    expect(isOrganizer({ organizerId: "user1" }, "user1")).toBe(true);
  });

  it("returns true for coOrganizerId match", () => {
    expect(
      isOrganizer({ organizerId: "user1", coOrganizerId: "user2" }, "user2")
    ).toBe(true);
  });

  it("returns false for neither", () => {
    expect(
      isOrganizer({ organizerId: "user1", coOrganizerId: "user2" }, "user3")
    ).toBe(false);
  });

  it("returns false when coOrganizerId is null", () => {
    expect(
      isOrganizer({ organizerId: "user1", coOrganizerId: null }, "user2")
    ).toBe(false);
  });

  it("returns false when coOrganizerId is undefined", () => {
    expect(isOrganizer({ organizerId: "user1" }, "user2")).toBe(false);
  });
});
