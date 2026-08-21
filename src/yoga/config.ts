// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

import { Config as CoreConfig } from "./core/config.ts";
import type { Errata, ExperimentalFeature } from "./generated/YGEnums.ts";

/**
 * Public Config wrapper over the core config, exposing the same surface as
 * the WASM binding's ConfigImpl.
 */
export class Config {
  /** @internal */
  core: CoreConfig = new CoreConfig();

  static create(): Config {
    return new Config();
  }

  // Binding compatibility: native/WASM configs require explicit destruction,
  // while JavaScript configs are owned by the garbage collector.
  free(): void {
    // No-op.
  }

  setExperimentalFeatureEnabled(feature: ExperimentalFeature, enabled: boolean): void {
    this.core.setExperimentalFeatureEnabled(feature, enabled);
  }

  isExperimentalFeatureEnabled(feature: ExperimentalFeature): boolean {
    return this.core.isExperimentalFeatureEnabled(feature);
  }

  setPointScaleFactor(factor: number): void {
    if (!(factor >= 0)) {
      throw new Error("Scale factor should not be less than zero");
    }
    this.core.setPointScaleFactor(factor);
  }

  getErrata(): Errata {
    return this.core.getErrata();
  }

  setErrata(errata: Errata): void {
    this.core.setErrata(errata);
  }

  useWebDefaults(): boolean {
    return this.core.useWebDefaults();
  }

  setUseWebDefaults(useWebDefaults: boolean): void {
    this.core.setUseWebDefaults(useWebDefaults);
  }
}
