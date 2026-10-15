import { MapScene } from './scene/MapScene'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Loader } from './ui/Loader'
import { OrientationNotice } from './ui/OrientationNotice'
import { TimelineBar } from './ui/TimelineBar'
import { VideoOverlay } from './video/VideoOverlay'

export default function App() {
  return (
    <ErrorBoundary>
      <MapScene />
      <TimelineBar />
      <VideoOverlay />
      <OrientationNotice />
      <Loader />
    </ErrorBoundary>
  )
}
