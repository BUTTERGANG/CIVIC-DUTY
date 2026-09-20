// src/data/zip-cities.ts
// Indiana ZIP code → municipality resolution for CIVIC-DUTY.
//
// The app currently ships three "covered" City boards — Fishers, Zionsville,
// and Indianapolis (see CITY_META in src/routes/cities.ts) — plus Hamilton
// County scrapers whose data lands under 'hamco' / individual town rows but
// has no dedicated board of its own yet. This registry maps a 5-digit ZIP to
// the CLOSEST covered city id so a user who types their ZIP lands on a board
// that reflects their town's civic data. When no covered city is reasonably
// nearby, the resolver marks the ZIP as uncovered and the route returns a
// friendly "not yet covered" message.

export interface ZipCityMatch {
  /** The CITY_META id we should switch the board to. */
  cityId: string | null;
  /** The actual town the ZIP belongs to (may differ from displayName). */
  municipality: string;
  /** Display name of the covered city the board switches to. */
  displayName: string | null;
  state: string;
  /** True when the ZIP resolves to a real, switchable board. */
  isCovered: boolean;
  /** Human note surfaced to the user (e.g. nearest, not-yet-dedicated). */
  note?: string;
  /** A sensible covered-city suggestion for uncovered ZIPs. */
  suggestedCityId?: string;
}

interface ExactRule {
  zip: string;
  cityId: string;
  municipality: string;
  note?: string;
}

interface PrefixRule {
  prefix: string;
  cityId: string;
  municipality: string;
}

// Exact ZIPs — Fishers/Zionsville cores plus the Hamilton & Boone County towns
// that have no dedicated board yet (resolved to their nearest covered city).
const EXACT: ExactRule[] = [
  // ── Fishers (Hamilton Co), fully covered ──
  { zip: '46037', cityId: 'fishers', municipality: 'Fishers' },
  { zip: '46038', cityId: 'fishers', municipality: 'Fishers' },
  { zip: '46256', cityId: 'fishers', municipality: 'Fishers', note: 'NE-side 46256 serves Fishers.' },
  // ── Zionsville (Boone Co), fully covered ──
  { zip: '46077', cityId: 'zionsville', municipality: 'Zionsville' },
  { zip: '46068', cityId: 'zionsville', municipality: 'Zionsville' },
  // ── Hamilton Co towns with no dedicated board → nearest covered (Fishers) ──
  { zip: '46032', cityId: 'fishers', municipality: 'Carmel', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46033', cityId: 'fishers', municipality: 'Carmel', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46060', cityId: 'fishers', municipality: 'Noblesville', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46062', cityId: 'fishers', municipality: 'Noblesville', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46074', cityId: 'fishers', municipality: 'Westfield', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46011', cityId: 'fishers', municipality: 'Arcadia', note: 'Hamilton Co. has no dedicated board yet — showing nearest covered city, Fishers.' },
  { zip: '46040', cityId: 'fishers', municipality: 'Fortville', note: 'No Fortville board — showing nearest covered city, Fishers.' },
  // ── Boone Co near Zionsville → nearest covered (Zionsville) ──
  { zip: '46072', cityId: 'zionsville', municipality: 'Whitestown', note: 'No Whitestown board — showing nearest covered city, Zionsville.' },
];

// Prefix rules — Indianapolis (Marion Co) covers the broad 462xx range.
const PREFIX: PrefixRule[] = [
  { prefix: '462', cityId: 'indy', municipality: 'Indianapolis' },
];

function toDigits(raw: string): string {
  return (raw || '').replace(/\D/g, '');
}

function coveredMatch(m: { cityId: string; municipality: string; note?: string }): ZipCityMatch {
  return {
    cityId: m.cityId,
    municipality: m.municipality,
    displayName: m.cityId, // route enriches with the real CITY_META displayName
    state: 'IN',
    isCovered: true,
    note: m.note,
  };
}

/**
 * Resolve a raw ZIP input to a covered municipality, or an uncovered marker.
 * Pure/synchronous — safe to call anywhere without a DB round-trip.
 */
export function resolveZip(rawZip: string): ZipCityMatch {
  const zip = toDigits(rawZip);
  if (!/^\d{5}$/.test(zip)) {
    return {
      cityId: null,
      municipality: 'unknown',
      displayName: null,
      state: 'IN',
      isCovered: false,
      note: 'Enter a valid 5-digit ZIP code.',
      suggestedCityId: 'fishers',
    };
  }

  // Exact ZIPs take precedence (covers Hamilton/Boone towns + Fishers cores).
  for (const rule of EXACT) {
    if (rule.zip === zip) return coveredMatch(rule);
  }

  // Then prefix ranges (Indianapolis 462xx).
  for (const rule of PREFIX) {
    if (zip.startsWith(rule.prefix)) return coveredMatch(rule);
  }

  return {
    cityId: null,
    municipality: 'unknown',
    displayName: null,
    state: 'IN',
    isCovered: false,
    note: "This ZIP isn't covered yet — try Fishers (46037/46038) or Indianapolis (462xx).",
    suggestedCityId: 'fishers',
  };
}