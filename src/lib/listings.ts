/**
 * DealNgn Public Listings API — build-time data fetching for Astro SSG.
 *
 * Fetches published listings from dealngn.com at build time.
 * Falls back to a cached JSON file if the API is unreachable.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Badge {
  text: string;
  color: string; // "red" | "black" | "amber" | etc.
}

export interface Listing {
  id: number;
  slug: string;
  name: string;
  address: string;
  city: string;
  state: string;
  county: string;
  brand: string;
  property_type: string;
  lot_acres: number | null;
  building_sqft: number | null;
  asking_price: number | null;
  noi: number | null;
  ebitda: number | null;
  cap_rate: number | null;
  vpd: number | null;
  monthly_gallons: number | null;
  status: string;
  deal_type: string;
  broker_role: string;
  crexi_url: string | null;
  tag: string | null;

  // Website syndication fields
  website_published: number; // 1=on-market, 2=off-market
  website_description: string;
  meta_title: string | null;
  meta_description: string | null;
  hero_image_url: string | null;
  gallery_image_urls: string[];
  highlights: string[];
  metrics: Record<string, string>;
  display_badges: Badge[];
  published_at: string | null;
  sort_order: number;

  created_at: string;
  updated_at: string;
}

export interface ListingsResponse {
  listings: Listing[];
  on_market: Listing[];
  off_market: Listing[];
  total: number;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const API_BASE =
  import.meta.env.DEALNGN_API_URL || "https://dealngn.com";
const CACHE_DIR = join(process.cwd(), "src", "data");
const CACHE_FILE = join(CACHE_DIR, "listings-cache.json");

// ---------------------------------------------------------------------------
// Fetch + cache
// ---------------------------------------------------------------------------

function readCache(): ListingsResponse | null {
  try {
    const raw = readFileSync(CACHE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeCache(data: ListingsResponse): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("[listings] Failed to write cache:", e);
  }
}

export async function getPublishedListings(): Promise<ListingsResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/public/listings`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`API returned ${res.status}`);
    }
    const data: ListingsResponse = await res.json();

    // Update local cache on success
    writeCache(data);

    return data;
  } catch (err) {
    console.warn(`[listings] API fetch failed, trying cache: ${err}`);
    const cached = readCache();
    if (cached) {
      console.info("[listings] Using cached listings data");
      return cached;
    }
    throw new Error(
      `Cannot fetch listings from API and no cache available: ${err}`
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getOnMarketListings(data: ListingsResponse): Listing[] {
  return data.on_market ?? data.listings.filter((l) => l.website_published === 1);
}

export function getOffMarketListings(data: ListingsResponse): Listing[] {
  return data.off_market ?? data.listings.filter((l) => l.website_published === 2);
}

export function formatPrice(price: number | null): string {
  if (!price) return "Call for Pricing";
  if (price >= 1_000_000) {
    const m = price / 1_000_000;
    return `$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(2)}M`;
  }
  return `$${price.toLocaleString("en-US")}`;
}

export function formatNumber(n: number | null, suffix = ""): string {
  if (!n) return "—";
  return `${n.toLocaleString("en-US")}${suffix}`;
}

export function generateListingTitle(listing: Listing): string {
  if (listing.meta_title) return listing.meta_title;
  const brand = listing.brand ? `${listing.brand} ` : "";
  const type = listing.property_type || "Gas Station";
  return `${brand}${type} for Sale — ${listing.city}, ${listing.state} | STAX Real Estate`;
}

export function generateListingDescription(listing: Listing): string {
  if (listing.meta_description) return listing.meta_description;
  if (listing.website_description) {
    return listing.website_description.slice(0, 155).replace(/\s+\S*$/, "…");
  }
  const parts = [listing.name];
  if (listing.asking_price) parts.push(formatPrice(listing.asking_price));
  if (listing.noi) parts.push(`${formatPrice(listing.noi)} NOI`);
  if (listing.monthly_gallons)
    parts.push(`${formatNumber(listing.monthly_gallons)}+ GPM`);
  parts.push("Contact STAX Real Estate for details.");
  return parts.join(" — ").slice(0, 160);
}
