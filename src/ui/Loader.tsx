import { useProgress } from '@react-three/drei'

export function Loader() {
  const { progress } = useProgress()
  if (progress >= 100) return null
  return (
    <div
      role="status"
      style={{
        position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
        background: '#d9cdb4', color: '#3b3224', font: '16px/1.4 system-ui, sans-serif',
      }}
    >
      Loading the battlefield… {Math.round(progress)}%
    </div>
  )
}
