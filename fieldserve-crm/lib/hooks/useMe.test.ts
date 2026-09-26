import { describe, expect, it } from "vitest";

import { shouldEnableMeQuery } from "./meQuery";

describe("shouldEnableMeQuery", () => {
  it("waits until Clerk has finished loading before fetching the current user", () => {
    expect(shouldEnableMeQuery({ isLoaded: false, isSignedIn: true })).toBe(false);
    expect(shouldEnableMeQuery({ isLoaded: true, isSignedIn: true })).toBe(true);
    expect(shouldEnableMeQuery({ isLoaded: true, isSignedIn: false })).toBe(false);
  });
});
