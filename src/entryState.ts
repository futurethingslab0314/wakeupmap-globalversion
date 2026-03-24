export type IdentityPresenceState = "empty" | "existing" | "new";

export interface InitialIdentityState {
  userName: string;
  isNameConfirmed: boolean;
  shouldShowEntryScreen: boolean;
}

export function normalizeIdentityName(value: string): string {
  return value.trim().toUpperCase();
}

export function getUserNameFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  return normalizeIdentityName(params.get("userName") ?? "");
}

export function getInitialIdentityState(search: string): InitialIdentityState {
  const userName = getUserNameFromSearch(search);

  if (userName) {
    return {
      userName,
      isNameConfirmed: true,
      shouldShowEntryScreen: false,
    };
  }

  return {
    userName: "",
    isNameConfirmed: false,
    shouldShowEntryScreen: true,
  };
}

export function getIdentityPresenceState(userName: string, existingNames: string[]): IdentityPresenceState {
  const normalizedName = normalizeIdentityName(userName);

  if (!normalizedName) {
    return "empty";
  }

  const hasMatch = existingNames.some((name) => normalizeIdentityName(name) === normalizedName);
  return hasMatch ? "existing" : "new";
}
