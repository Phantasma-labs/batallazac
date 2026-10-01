import { MapScene } from './scene/MapScene'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Loader } from './ui/Loader'

export default function App() {
  return (
    <ErrorBoundary>
      <MapScene />
      <Loader />
    </ErrorBoundary>
  )
}
