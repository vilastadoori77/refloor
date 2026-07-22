/**
 * Static product catalog (MOCK-041 / MOCK-042).
 *
 * Item numbers, descriptions, category and unit facts are STABLE — they never
 * depend on the dataset seed, so item `no` is a durable key. `i360Id` is derived
 * deterministically from `no` (seed-independent) to look like the Salesforce
 * ids in the docx samples ("a28PZ000009ii1mYAA").
 *
 * Flooring names come from screenshot 1 (COREtec Pro Plus lines, Captivate,
 * Iconic, Paragon Tile Plus, Alpine Telluride, Artisan Plank, …); additional
 * materials from screenshot 2 (1/4" Round Molding, Metal T Track, Schonox SL,
 * Schonox SHP Primer, …).
 */
import { makeRng } from './rng';

export interface CatalogItem {
  no: string;
  description: string;
  i360Id: string;
  itemCategoryCode: string;
  /** Flooring: 18–28. Non-flooring: 0. */
  sqftPerCase: number;
  /** Moldings/transitions: > 0. Others: 0. */
  linearFtPerUnit: number;
}

/** Deterministic, seed-independent 18-char Salesforce-style id from an item no. */
function i360Id(no: string): string {
  const r = makeRng('i360:' + no);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let s = 'a28PZ00000';
  for (let i = 0; i < 8; i++) s += chars[r.int(0, chars.length - 1)];
  return s;
}

interface Seed {
  desc: string;
  cat: string;
  sqft: number;
  linear: number;
}

// Flooring — screenshot 1 (26 items, sqftPerCase 18–28, linearFtPerUnit 0).
const FLOORING_SEEDS: Seed[] = [
  { desc: 'Alpine Telluride', cat: 'FLOORING', sqft: 23.8, linear: 0 },
  { desc: 'Artisan Plank Finnish Pine', cat: 'FLOORING', sqft: 21.4, linear: 0 },
  { desc: 'Coretec Pro Plus Enhanced XL Adair Oak', cat: 'FLOORING', sqft: 26.2, linear: 0 },
  { desc: 'Coretec Pro Plus Enhanced Rustic Pine', cat: 'FLOORING', sqft: 20.1, linear: 0 },
  { desc: 'Coretec Pro Plus HD Nantucket Oak', cat: 'FLOORING', sqft: 24.5, linear: 0 },
  { desc: 'Coretec Pro Plus Kingswood Oak', cat: 'FLOORING', sqft: 22.7, linear: 0 },
  { desc: 'Captivate Weathered Barnwood', cat: 'FLOORING', sqft: 19.6, linear: 0 },
  { desc: 'Captivate Coastal Grey', cat: 'FLOORING', sqft: 27.3, linear: 0 },
  { desc: 'Iconic Smoked Hickory', cat: 'FLOORING', sqft: 25.0, linear: 0 },
  { desc: 'Iconic Sun-Bleached Oak', cat: 'FLOORING', sqft: 18.4, linear: 0 },
  { desc: 'Paragon Tile Plus Carrara Marble', cat: 'FLOORING', sqft: 28.0, linear: 0 },
  { desc: 'Paragon Tile Plus Slate Grey', cat: 'FLOORING', sqft: 23.1, linear: 0 },
  { desc: 'Paragon XL Aged Walnut', cat: 'FLOORING', sqft: 21.9, linear: 0 },
  { desc: 'Everlife Cyrus Ludlow', cat: 'FLOORING', sqft: 24.8, linear: 0 },
  { desc: 'Everlife Dryback Aventura', cat: 'FLOORING', sqft: 19.2, linear: 0 },
  { desc: 'Dixie Home Prime Plank Chestnut', cat: 'FLOORING', sqft: 26.7, linear: 0 },
  { desc: 'Dixie Home Trucor Applewood', cat: 'FLOORING', sqft: 20.6, linear: 0 },
  { desc: 'Mannington Adura Max Napa', cat: 'FLOORING', sqft: 22.3, linear: 0 },
  { desc: 'Mannington Adura Rigid Sausalito', cat: 'FLOORING', sqft: 25.5, linear: 0 },
  { desc: 'Shaw Floorte Anvil Plus Umber Oak', cat: 'FLOORING', sqft: 18.9, linear: 0 },
  { desc: 'Shaw Floorte Paragon Mixed Width', cat: 'FLOORING', sqft: 27.8, linear: 0 },
  { desc: 'Karndean Korlok Baltic Limed Oak', cat: 'FLOORING', sqft: 23.4, linear: 0 },
  { desc: 'Karndean Van Gogh French Oak', cat: 'FLOORING', sqft: 21.1, linear: 0 },
  { desc: 'Provenza MaxCore Antico', cat: 'FLOORING', sqft: 24.0, linear: 0 },
  { desc: 'Provenza Uptown Chic Boardwalk', cat: 'FLOORING', sqft: 19.8, linear: 0 },
  { desc: 'Southwind Authentic Plank Driftwood', cat: 'FLOORING', sqft: 26.0, linear: 0 },
];

// Additional materials — screenshot 2 (16 items across 4 non-flooring categories).
const ADDITIONAL_SEEDS: Seed[] = [
  // MOLDING (linearFtPerUnit > 0)
  { desc: '1/4" Round Molding-Vinyl White', cat: 'MOLDING', sqft: 0, linear: 8 },
  { desc: 'Quarter Round Molding-Oak', cat: 'MOLDING', sqft: 0, linear: 8 },
  { desc: 'Base Shoe Molding-White', cat: 'MOLDING', sqft: 0, linear: 8 },
  { desc: 'Wall Base Cove 4in-Black', cat: 'MOLDING', sqft: 0, linear: 12 },
  // TRANSITIONS (linearFtPerUnit > 0)
  { desc: 'Metal T Track', cat: 'TRANSITIONS', sqft: 0, linear: 12 },
  { desc: 'T-Molding Transition-Oak', cat: 'TRANSITIONS', sqft: 0, linear: 7.5 },
  { desc: 'End Cap Transition-Vinyl', cat: 'TRANSITIONS', sqft: 0, linear: 7.5 },
  { desc: 'Stair Nose-Flush Mount', cat: 'TRANSITIONS', sqft: 0, linear: 4 },
  { desc: 'Reducer Strip-Multipurpose', cat: 'TRANSITIONS', sqft: 0, linear: 7.5 },
  // ADHESIVES / SEALANTS (linearFtPerUnit 0)
  { desc: 'Schonox SL Self-Leveler', cat: 'ADHESIVES / SEALANTS', sqft: 0, linear: 0 },
  { desc: 'Schonox SHP Primer', cat: 'ADHESIVES / SEALANTS', sqft: 0, linear: 0 },
  { desc: 'Bostik Pro-Cure Adhesive', cat: 'ADHESIVES / SEALANTS', sqft: 0, linear: 0 },
  { desc: '100% Silicone Sealant-Clear', cat: 'ADHESIVES / SEALANTS', sqft: 0, linear: 0 },
  // OTHER (linearFtPerUnit 0)
  { desc: 'Underlayment Foam Roll', cat: 'OTHER', sqft: 0, linear: 0 },
  { desc: 'Moisture Barrier Film 6mil', cat: 'OTHER', sqft: 0, linear: 0 },
  { desc: 'Tack Strip Bundle', cat: 'OTHER', sqft: 0, linear: 0 },
];

function build(seeds: Seed[], startNo: number): CatalogItem[] {
  return seeds.map((s, i) => {
    const no = `IN-1${String(startNo + i).padStart(5, '0')}`;
    return {
      no,
      description: s.desc,
      i360Id: i360Id(no),
      itemCategoryCode: s.cat,
      sqftPerCase: s.sqft,
      linearFtPerUnit: s.linear,
    };
  });
}

/** ≥ 24 flooring items (IN-100100 …). */
export const FLOORING: CatalogItem[] = build(FLOORING_SEEDS, 100);

/** ≥ 8 additional-materials items (IN-100300 …). */
export const ADDITIONAL: CatalogItem[] = build(ADDITIONAL_SEEDS, 300);

/** Every catalog item. */
export const CATALOG: CatalogItem[] = [...FLOORING, ...ADDITIONAL];
