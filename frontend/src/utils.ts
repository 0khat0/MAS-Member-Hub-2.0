// UUID validation utility
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// API URL utility
export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
}

// Toronto timezone utilities
export function getTorontoTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
}

export function getTorontoDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Toronto" }); // Returns YYYY-MM-DD
}

export function getTorontoDateTimeString(date: Date = new Date()): string {
  return date.toLocaleString("en-US", { 
    timeZone: "America/Toronto",
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function getTorontoDayOfWeek(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { 
    timeZone: "America/Toronto",
    weekday: 'long'
  });
}

export function getMondayOfCurrentWeekToronto(date: Date = new Date()): Date {
  const torontoDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const day = torontoDate.getDay();
  const diff = torontoDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(torontoDate.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isSameDayToronto(date1: Date, date2: Date): boolean {
  const torontoDate1 = getTorontoDateString(date1);
  const torontoDate2 = getTorontoDateString(date2);
  return torontoDate1 === torontoDate2;
}

// Local storage utilities
export function getMemberId(): string | null {
  const memberId = localStorage.getItem("member_id");
  return memberId && isValidUUID(memberId) ? memberId : null;
}

export function setMemberId(memberId: string): void {
  if (isValidUUID(memberId)) {
    localStorage.setItem("member_id", memberId);
  }
}

export function clearMemberData(): void {
  localStorage.removeItem("member_id");
  localStorage.removeItem("member_email");
} 