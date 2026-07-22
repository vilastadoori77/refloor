/**
 * consolidator.test.ts — TEST-010, 011, 012, 013, 016.
 * Every expectation is derived from the injected config (PB-001 guardrail).
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG } from '@inventory/shared';
import type { AvailabilityConfig } from '@inventory/shared';
import {
  computeAvailable,
  classifyStatus,
  consolidate,
  projectItemStatus,
} from '../src/consolidator';
import { inv, po, dem } from './fixtures';

const ITEM = 'IN-100103';
const SQFT = 23.8;

// ── TEST-010 — Consolidation math (ASM-001 default) ──────────────────────────
describe('TEST-010 consolidation math (ASM-001 default)', () => {
  it('010.1 F-A single item+location', () => {
    const inventory = [inv({ no: ITEM, qoh: 100, sqftPerCase: SQFT })];
    const pos = [
      po({ no: ITEM, qpo: 40, expected_Receipt_Date: '2026-08-10' }),
      po({ no: ITEM, qpo: 10, expected_Receipt_Date: '2026-08-01' }),
    ];
    const demand = [
      dem({ no: ITEM, demand: 30, onPO: 20, qoh: 100 }),
      dem({ no: ITEM, demand: 20, onPO: 10, qoh: 100 }),
    ];
    const rows = consolidate(inventory, pos, demand, DEFAULT_CONFIG);
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.onHand).toBe(100);
    expect(r.allocated).toBe(50);
    expect(r.ordered).toBe(50);
    // Derived from the injected strategy, not a magic number.
    const expectedAvail = computeAvailable(DEFAULT_CONFIG, {
      onHand: 100,
      allocated: 50,
      qoh: 100,
      onPO: 30,
      demand: 50,
    });
    expect(r.available).toBe(expectedAvail);
    expect(r.available).toBe(50);
    expect(r.availableSqft).toBeCloseTo(50 * SQFT, 2);
    // SVC-004: earliest expected receipt date.
    expect(r.nextReceiptDate).toBe('2026-08-01');
  });

  it('010.2 F-B two locations keyed separately (no cross bleed)', () => {
    const inventory = [
      inv({ no: ITEM, qoh: 100, locationCode: 'CHA', locationName: 'Charlotte' }),
      inv({ no: ITEM, qoh: 40, locationCode: 'DET', locationName: 'Detroit' }),
    ];
    const pos = [
      po({ no: ITEM, qpo: 40, locationCode: 'CHA' }),
      po({ no: ITEM, qpo: 5, locationCode: 'DET' }),
    ];
    const demand = [
      dem({ no: ITEM, demand: 30, locationCode: 'CHA' }),
      dem({ no: ITEM, demand: 10, locationCode: 'DET' }),
    ];
    const rows = consolidate(inventory, pos, demand, DEFAULT_CONFIG);
    expect(rows).toHaveLength(2);
    const cha = rows.find((r) => r.locationCode === 'CHA')!;
    const det = rows.find((r) => r.locationCode === 'DET')!;
    expect(cha.onHand).toBe(100);
    expect(cha.allocated).toBe(30);
    expect(cha.available).toBe(70);
    expect(det.onHand).toBe(40);
    expect(det.allocated).toBe(10);
    expect(det.available).toBe(30);
  });

  it('010.3 F-C multi-project demand sums allocated', () => {
    const inventory = [inv({ no: ITEM, qoh: 100 })];
    const demand = [
      dem({ no: ITEM, demand: 10, projectName: 'P1' }),
      dem({ no: ITEM, demand: 15, projectName: 'P2' }),
      dem({ no: ITEM, demand: 5, projectName: 'P3' }),
    ];
    const rows = consolidate(inventory, [], demand, DEFAULT_CONFIG);
    expect(rows).toHaveLength(1);
    expect(rows[0].allocated).toBe(30);
    expect(rows[0].available).toBe(70);
  });

  it('010.4 availableSqft = available × sqftPerCase (2-decimal)', () => {
    const inventory = [inv({ no: ITEM, qoh: 100, sqftPerCase: 23.83 })];
    const demand = [dem({ no: ITEM, demand: 50 })];
    const rows = consolidate(inventory, [], demand, DEFAULT_CONFIG);
    const r = rows[0];
    expect(r.availableSqft).toBe(Math.round(r.available * 23.83 * 100) / 100);
    expect(r.availableSqft).toBe(1191.5);
  });
});

// ── TEST-011 — Threshold classification (ASM-002) ────────────────────────────
describe('TEST-011 threshold classification (config-driven, `<` not `<=`)', () => {
  const cfg = DEFAULT_CONFIG;
  const cases: Array<[number, number, string]> = [
    [-1, 40, 'red'],
    [0, 40, 'yellow'],
    [9, 40, 'yellow'],
    [10, 40, 'green'], // 10 is NOT < 25% of 40 (=10) → green
    [11, 40, 'green'],
    [9, 0, 'yellow'], // min-10 rule when allocated=0
    [10, 0, 'green'],
  ];
  for (const [available, allocated, expected] of cases) {
    it(`avail=${available} alloc=${allocated} → ${expected}`, () => {
      expect(classifyStatus(cfg, available, allocated)).toBe(expected);
    });
  }
});

// ── TEST-012 — null locationCode → UNK, nothing dropped ──────────────────────
describe('TEST-012 null locationCode bucketed under UNK', () => {
  it('consolidates null-location rows under UNK, drops nothing, no NaN', () => {
    const inventory = [
      inv({ no: ITEM, qoh: 10, locationCode: null }),
      inv({ no: 'IN-100200', qoh: 5, locationCode: null }),
    ];
    const demand = [
      dem({ no: ITEM, demand: 3, locationCode: null }),
      dem({ no: 'IN-100200', demand: 1, locationCode: null }),
    ];
    const rows = consolidate(inventory, [], demand, DEFAULT_CONFIG);
    expect(rows.every((r) => r.locationCode === 'UNK')).toBe(true);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(Number.isNaN(r.available)).toBe(false);
      expect(Number.isNaN(r.availableSqft)).toBe(false);
    }
  });
});

// ── TEST-013 — Project item status (ASM-003) ─────────────────────────────────
describe('TEST-013 project item status (config-driven)', () => {
  const cfg = DEFAULT_CONFIG;
  it('013.1 ready when available ≥ required', () => {
    const r = projectItemStatus(cfg, { required: 20, available: 25, ordered: 0, picked: 0 });
    expect(r.itemStatus).toBe('ready');
    expect(r.remainder).toBe(20);
  });
  it('013.2 attention when PO covers', () => {
    const r = projectItemStatus(cfg, { required: 20, available: 10, ordered: 15, picked: 0 });
    expect(r.itemStatus).toBe('attention');
    expect(r.remainder).toBe(20);
  });
  it('013.3 short otherwise', () => {
    const r = projectItemStatus(cfg, { required: 20, available: 5, ordered: 5, picked: 0 });
    expect(r.itemStatus).toBe('short');
    expect(r.remainder).toBe(20);
  });
  it('013.4 remainder = required − picked', () => {
    const r = projectItemStatus(cfg, { required: 20, available: 25, ordered: 0, picked: 20 });
    expect(r.itemStatus).toBe('ready');
    expect(r.remainder).toBe(0);
  });
});

// ── TEST-016 — Config-drives-math proof (PB-001 keystone) ⭐ ──────────────────
describe('TEST-016 config swap changes numbers AND colors (no source edit)', () => {
  const inventory = [inv({ no: ITEM, qoh: 100, sqftPerCase: SQFT })];
  const pos = [po({ no: ITEM, qpo: 40 })];
  const demand = [dem({ no: ITEM, demand: 50, onPO: 30, qoh: 100 })];

  const configX: AvailabilityConfig = DEFAULT_CONFIG; // onHandMinusAllocated
  const configY: AvailabilityConfig = {
    refreshSeconds: 60,
    availabilityStrategy: 'netInventory', // qoh + onPO − demand
    thresholds: {
      redBelow: 100, // aggressive thresholds so the color also flips
      yellowFractionOfAllocated: 0.25,
      yellowMinUnitsWhenNoAllocated: 10,
    },
    projectStatusStrategy: 'availabilityVsRequired',
  };

  it('numbers differ purely from the config swap', () => {
    const x = consolidate(inventory, pos, demand, configX)[0];
    const y = consolidate(inventory, pos, demand, configY)[0];
    // X: 100 − 50 = 50 ; Y: 100 + 30 − 50 = 80
    expect(x.available).toBe(50);
    expect(y.available).toBe(80);
    expect(x.available).not.toBe(y.available);
    expect(x.availableSqft).not.toBe(y.availableSqft);
  });

  it('colors differ purely from the config swap', () => {
    const x = consolidate(inventory, pos, demand, configX)[0];
    const y = consolidate(inventory, pos, demand, configY)[0];
    // X thresholds: 50 ≥ 25% of 50 → green. Y: 80 < redBelow 100 → red.
    expect(x.status).toBe('green');
    expect(y.status).toBe('red');
    expect(x.status).not.toBe(y.status);
  });
});
