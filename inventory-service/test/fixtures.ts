/**
 * fixtures.ts — inline crafted fixtures for the unit tests (no network).
 */
import type {
  BcInventoryRow,
  BcPurchaseOrderRow,
  BcDemandRow,
} from '@inventory/shared';

export function inv(
  overrides: Partial<BcInventoryRow> & Pick<BcInventoryRow, 'no' | 'qoh'>,
): BcInventoryRow {
  return {
    no: overrides.no,
    description: overrides.description ?? 'Alpine Telluride',
    i360Id: overrides.i360Id ?? 'a28PZ000009ii1mYAA',
    sqftPerCase: overrides.sqftPerCase ?? 23.8,
    linearFtPerUnit: overrides.linearFtPerUnit ?? 0,
    itemCategoryCode: overrides.itemCategoryCode ?? 'FLOORING',
    locationCode: overrides.locationCode === undefined ? 'CHA' : overrides.locationCode,
    locationName: overrides.locationName ?? 'Charlotte',
    qoh: overrides.qoh,
  };
}

export function po(
  overrides: Partial<BcPurchaseOrderRow> & Pick<BcPurchaseOrderRow, 'no' | 'qpo'>,
): BcPurchaseOrderRow {
  return {
    no: overrides.no,
    description: overrides.description ?? 'Alpine Telluride',
    i360Id: overrides.i360Id ?? 'a28PZ000009ii1mYAA',
    sqftPerCase: overrides.sqftPerCase ?? 23.8,
    linearFtPerUnit: overrides.linearFtPerUnit ?? 0,
    itemCategoryCode: overrides.itemCategoryCode ?? 'FLOORING',
    locationCode: overrides.locationCode === undefined ? 'CHA' : overrides.locationCode,
    locationName: overrides.locationName ?? 'Charlotte',
    qpo: overrides.qpo,
    sfdcSoNo: overrides.sfdcSoNo ?? '',
    purchNo: overrides.purchNo ?? 'PO-000001',
    expected_Receipt_Date: overrides.expected_Receipt_Date ?? '2026-08-10',
  };
}

export function dem(
  overrides: Partial<BcDemandRow> &
    Pick<BcDemandRow, 'no' | 'demand'>,
): BcDemandRow {
  const qoh = overrides.qoh ?? 0;
  const onPO = overrides.onPO ?? 0;
  const demand = overrides.demand;
  return {
    no: overrides.no,
    description: overrides.description ?? 'Alpine Telluride',
    qoh,
    onPO,
    demand,
    netInventory: overrides.netInventory ?? qoh + onPO - demand,
    locationName: overrides.locationName ?? 'Charlotte',
    locationCode: overrides.locationCode === undefined ? 'CHA' : overrides.locationCode,
    itemKey: overrides.itemKey ?? `${overrides.no}-CHA`,
    projectName: overrides.projectName ?? 'Vinyl Flooring : Doe, Jane',
  };
}
