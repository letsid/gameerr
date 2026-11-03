import type { ValueTransformer } from 'typeorm';

/**
 * Stores a list of numbers as a comma separated string. An empty list is kept
 * as an empty string so it can be told apart from a missing value (null).
 */
export const numberArrayTransformer: ValueTransformer = {
  from: (value: string | null): number[] | null => {
    if (value === null || value === undefined) {
      return null;
    }
    if (value === '') {
      return [];
    }
    return value
      .split(',')
      .map((v) => Number(v))
      .filter((v) => !isNaN(v));
  },
  to: (value: number[] | null | undefined): string | null => {
    if (!Array.isArray(value)) {
      return null;
    }
    return value.join(',');
  },
};
