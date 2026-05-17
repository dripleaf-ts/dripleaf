import { ParticleType } from "@dripleaf/registry"
import type { Vec3 } from "vec3"

export type ParticleOptions =
  | { type: ParticleType }
  | { type: ParticleType.DragonBreath; power: number }
  | { type: ParticleType.Dust; color: number; scale: number }
  | { type: ParticleType.DustColorTransition; fromColor: number; toColor: number; scale: number }
  | { type: ParticleType.Effect | ParticleType.InstantEffect; color: number; power: number }
  | { type: ParticleType.EntityEffect | ParticleType.Flash | ParticleType.TintedLeaves; color: number }
  | { type: ParticleType.SculkCharge; roll: number }
  | { type: ParticleType.Shriek; delay: number }
  | { type: ParticleType.Block | ParticleType.BlockMarker | ParticleType.FallingDust; blockState: number }
  | { type: ParticleType.DustPillar; blockState: number; scale: number }
  | { type: ParticleType.Trail; target: Vec3; color: number; duration: number }
