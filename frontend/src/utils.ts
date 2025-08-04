// UUID validation utility
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// API URL utility
export function getApiUrl(): string {
  return import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
}

// Toronto timezone utilities
export function getEasternTime(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
}

export function getEasternDateString(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Toronto" }); // Returns YYYY-MM-DD
}

export function getEasternDateTimeString(date: Date = new Date()): string {
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

export function getEasternDayOfWeek(date: Date = new Date()): string {
  return date.toLocaleDateString("en-US", { 
    timeZone: "America/Toronto",
    weekday: 'long'
  });
}

export function getMondayOfCurrentWeekEastern(date: Date = new Date()): Date {
  const torontoDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const day = torontoDate.getDay();
  const diff = torontoDate.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
  const monday = new Date(torontoDate.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function isSameDayEastern(date1: Date, date2: Date): boolean {
  const torontoDate1 = getEasternDateString(date1);
  const torontoDate2 = getEasternDateString(date2);
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

// Report issue utility
export function reportIssue(): void {
  const subject = encodeURIComponent('MAS Member Hub - Issue Report');
  const body = encodeURIComponent(`Hello Omar,

I'm reporting an issue with the MAS Member Hub application.

Issue Description:
[Please describe the issue you encountered]

Steps to Reproduce:
[Please list the steps to reproduce the issue]

Additional Information:
- Browser: ${navigator.userAgent}
- URL: ${window.location.href}
- Date: ${new Date().toISOString()}
- Member ID: ${getMemberId() || 'Not logged in'}

Thank you for your time!`);
  
  window.open(`mailto:omark0620@outlook.com?subject=${subject}&body=${body}`, '_blank');
} 