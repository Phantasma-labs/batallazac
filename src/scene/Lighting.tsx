/** Soft sky/ground fill plus a warm low sun from the north-west so relief reads from the default south view. */
export function Lighting() {
  return (
    <>
      <hemisphereLight args={['#dfe6ff', '#8a7a5a', 1.0]} />
      <directionalLight position={[-500, 500, -400]} intensity={1.6} color="#fff1d6" />
    </>
  )
}
