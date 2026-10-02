import type { Root } from "../manifest.js";

export type Detection = { roots: Root[]; description: string };

export type Driver = {
  name: string;
  detect: (dir: string) => Detection | null;
  conventions: string;
};
