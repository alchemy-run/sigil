// SPDX-License-Identifier: MIT
// Derived from Yoga. See THIRD_PARTY_NOTICES.md.

// Port of yoga/config/Config.h and yoga/config/Config.cpp.

import { Errata, ExperimentalFeature } from "../generated/YGEnums.ts";

// Whether moving a node from an old to new config should dirty previously
// calculated layout results.
export function configUpdateInvalidatesLayout(oldConfig: Config, newConfig: Config): boolean {
  return (
    oldConfig.getErrata() !== newConfig.getErrata() ||
    oldConfig.getEnabledExperiments() !== newConfig.getEnabledExperiments() ||
    oldConfig.getPointScaleFactor() !== newConfig.getPointScaleFactor() ||
    oldConfig.useWebDefaults() !== newConfig.useWebDefaults()
  );
}

export class Config {
  private useWebDefaults_ = false;
  private version_ = 0;
  private experimentalFeatures_ = 0;
  private errata_: Errata = Errata.MinSizeUndefinedInsteadOfAuto;
  private pointScaleFactor_ = 1.0;

  setUseWebDefaults(useWebDefaults: boolean): void {
    this.useWebDefaults_ = useWebDefaults;
  }

  useWebDefaults(): boolean {
    return this.useWebDefaults_;
  }

  setExperimentalFeatureEnabled(feature: ExperimentalFeature, enabled: boolean): void {
    if (this.isExperimentalFeatureEnabled(feature) !== enabled) {
      this.experimentalFeatures_ = enabled
        ? this.experimentalFeatures_ | (1 << feature)
        : this.experimentalFeatures_ & ~(1 << feature);
      this.version_++;
    }
  }

  isExperimentalFeatureEnabled(feature: ExperimentalFeature): boolean {
    return (this.experimentalFeatures_ & (1 << feature)) !== 0;
  }

  getEnabledExperiments(): number {
    return this.experimentalFeatures_;
  }

  setErrata(errata: Errata): void {
    if (this.errata_ !== errata) {
      this.errata_ = errata;
      this.version_++;
    }
  }

  addErrata(errata: Errata): void {
    if (!this.hasErrata(errata)) {
      this.errata_ |= errata;
      this.version_++;
    }
  }

  removeErrata(errata: Errata): void {
    if (this.hasErrata(errata)) {
      this.errata_ &= ~errata;
      this.version_++;
    }
  }

  getErrata(): Errata {
    return this.errata_;
  }

  hasErrata(errata: Errata): boolean {
    return (this.errata_ & errata) !== Errata.None;
  }

  setPointScaleFactor(pointScaleFactor: number): void {
    const value = pointScaleFactor;
    if (this.pointScaleFactor_ !== value) {
      this.pointScaleFactor_ = value;
      this.version_++;
    }
  }

  getPointScaleFactor(): number {
    return this.pointScaleFactor_;
  }

  getVersion(): number {
    return this.version_;
  }
}

let defaultConfig: Config | null = null;

export function getDefaultConfig(): Config {
  if (defaultConfig === null) {
    defaultConfig = new Config();
  }
  return defaultConfig;
}
