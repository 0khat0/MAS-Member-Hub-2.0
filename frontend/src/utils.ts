// UUID validation utility
export function isValidUUID(uuid: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(uuid);
}

// Account number validation utility
export function isValidAccountCode(code: string): boolean {
  return /^[A-Z2-9]{6}$/.test(code.toUpperCase());
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

// Daily Muay Thai message helper (rotates by day of year in Eastern time)
export function getDailyMuayThaiMessage(): string {
  const messages = [
    "Go smash those pads!",
    "Unleash your inner warrior!",
    "Keep your guard up and your spirit higher!",
    "Every round makes you stronger!",
    "Train hard, fight easy!",
    "Respect. Discipline. Power.",
    "Push your limits today!",
    "Channel your energy into every strike!",
    "Stay sharp, stay humble!",
    "Victory is earned in the gym!",
    "Let your kicks fly!",
    "Muay Thai: Art of Eight Limbs!",
    "Breathe, focus, conquer!",
    "You are your only competition!",
    "Make every session count!"
  ];
  const now = getEasternTime();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDayMs = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDayMs);
  return messages[dayOfYear % messages.length];
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
  localStorage.removeItem("household_code");
}

// Session reconciliation utility
export async function reconcileSession(): Promise<any> {
  try {
    const API_URL = getApiUrl();
    const response = await fetch(`${API_URL}/v1/auth/reconcile-session`, {
      method: 'POST',
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      // Update localStorage with authoritative data
      if (data.householdId) {
        localStorage.setItem('household_id', data.householdId);
      }
      if (data.ownerEmail) {
        localStorage.setItem('member_email', data.ownerEmail);
      }
      if (data.householdCode) {
        localStorage.setItem('household_code', data.householdCode);
      }
      return data;
    }
    return null;
  } catch (error) {
    console.error('Session reconciliation failed:', error);
    return null;
  }
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