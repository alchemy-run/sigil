import type { ColorSupportLevel } from "#/capabilities/detect.ts";
import { colorProfileFromLevel, type ColorProfile } from "#/screen/color-profile.ts";

/** A user-selected output policy. `auto` follows the target stream. */
export type ColorPolicy = "auto" | ColorProfile;

/** The three distinct inputs and result of terminal color negotiation. */
export type ColorState = {
  /** The stream/terminal fact after environment and query detection. */
  readonly detected: ColorProfile;
  /** The application's policy for this render instance. */
  readonly policy: ColorPolicy;
  /** The profile the serializer must actually emit. */
  readonly effective: ColorProfile;
};

export function resolveColorProfile(
  detectedLevel: ColorSupportLevel,
  policy: ColorPolicy = "auto",
): ColorProfile {
  return policy === "auto" ? colorProfileFromLevel(detectedLevel) : policy;
}

export function colorState(
  capabilities: { readonly color: { readonly level: ColorSupportLevel } },
  policy: ColorPolicy = "auto",
): ColorState {
  const detected = colorProfileFromLevel(capabilities.color.level);
  return {
    detected,
    policy,
    effective: policy === "auto" ? detected : policy,
  };
}
