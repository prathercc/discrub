/**
 * Guards for the Invalid Date objects MUI's date/time pickers emit while a
 * typed value is incomplete (date filled in, time still placeholder). An
 * Invalid Date is truthy and passes `!!` checks, so without these guards it
 * flows through Apply into search criteria and finally NaN-poisons the
 * date-to-snowflake conversion (#250).
 */

/** True when the value is a Date carrying NaN. */
export const isInvalidDate = (d: Date | null | undefined): boolean =>
  d instanceof Date && Number.isNaN(d.getTime());

/** An incomplete bound is no bound: pass real Dates through, drop the rest. */
export const dropInvalidDate = (d: Date | null | undefined): Date | null =>
  d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
