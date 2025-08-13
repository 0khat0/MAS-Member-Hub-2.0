/** Remove app keys that can leak state between households. */
export function clearAppStorage() {
  const KEYS = [
    "household_id",
    "selected_member_id",
    "family_members",
    "last_auth_time",
  ];
  for (const k of KEYS) localStorage.removeItem(k);
  sessionStorage.clear();
}

export function setHouseholdId(id: string) {
  localStorage.setItem("household_id", id);
}

export function getHouseholdId(): string | null {
  return localStorage.getItem("household_id");
}
