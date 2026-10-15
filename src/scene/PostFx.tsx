import { useFrame } from '@react-three/fiber'
import { DepthOfField, EffectComposer, Vignette } from '@react-three/postprocessing'
import type { DepthOfFieldEffect, VignetteEffect } from 'postprocessing'
import { useRef } from 'react'
import { UnsignedByteType } from 'three'
import { shot } from '../camera/shot'
import { VIGNETTE, macroAmount, macroLook } from './macro'

/**
 * Post-processing: a vignette, and a depth of field that appears as the lens zooms in on a statue, so the close-ups
 * read like macro photos of a miniature. Both follow the lens every frame (see `macro.ts`); the camera's focus is
 * the point the lens is aimed at.
 */
export function PostFx() {
  const dof = useRef<DepthOfFieldEffect>(null)
  const vignette = useRef<VignetteEffect>(null)

  useFrame(() => {
    // The depth of field comes from the camera (the macro look as the lens zooms, or a hand-placed shot's own); the vignette follows the zoom.
    if (dof.current) {
      dof.current.bokehScale = shot.blur
      dof.current.cocMaterial.focusDistance = shot.focusDistance
      dof.current.cocMaterial.focusRange = shot.range
    }
    if (vignette.current) vignette.current.darkness = macroLook(macroAmount(shot.wideFov, shot.fov)).vignette
  })

  // Anti-aliasing comes from the composer's own multisampled buffer (the canvas itself is not antialiased). An 8-bit
  // buffer clips the glows' emissive light per pixel, as the plain canvas did; a half-float one lets it bloom wider.
  return (
    <EffectComposer multisampling={4} frameBufferType={UnsignedByteType}>
      <DepthOfField ref={dof} resolutionScale={0.5} />
      <Vignette ref={vignette} offset={VIGNETTE.offset} darkness={VIGNETTE.wide} />
    </EffectComposer>
  )
}
