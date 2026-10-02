import { genericDriver } from "./drivers/generic.js";
import { okfDriver } from "./drivers/okf.js";
import type { Detection, Driver } from "./drivers/types.js";

export type Probe = Detection & { format: string };

const specificDrivers: Driver[] = [okfDriver];
const allDrivers: Driver[] = [...specificDrivers, genericDriver];

export function probeDir(dir: string): Probe {
  for (const driver of specificDrivers) {
    const match = driver.detect(dir);
    if (match) return { format: driver.name, ...match };
  }
  return { format: genericDriver.name, ...genericDriver.detect(dir) };
}

export function conventionsFor(format: string): string | null {
  return allDrivers.find((driver) => driver.name === format)?.conventions ?? null;
}
