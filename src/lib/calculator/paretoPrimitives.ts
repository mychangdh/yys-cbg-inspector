import type { FastDimension, FastVector } from "./fastTypes";

export const PARETO_EPSILON = 1e-9;

export function lowerBound(values: readonly number[], target: number): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

export function upperBound(values: readonly number[], target: number): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = left + Math.floor((right - left) / 2);
    if (values[middle] <= target) left = middle + 1;
    else right = middle;
  }
  return left;
}

export function dominatesOnDimensions<T extends FastVector>(
  left: T,
  right: T,
  dimensions: readonly FastDimension[],
): boolean {
  let strictlyBetter = false;
  for (const key of dimensions) {
    if (left[key] < right[key] - PARETO_EPSILON) return false;
    if (left[key] > right[key] + PARETO_EPSILON) strictlyBetter = true;
  }
  return strictlyBetter;
}
