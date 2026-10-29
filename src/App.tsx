import { MapScene } from './scene/MapScene'
import { ErrorBoundary } from './ui/ErrorBoundary'
import { Loader } from './ui/Loader'
import { OrientationNotice } from './ui/OrientationNotice'
import { Subtitle } from './ui/Subtitle'
import { TimelineBar } from './ui/TimelineBar'
import { GeneralButtons } from './profiles/GeneralButtons'
import { ProfilePanel } from './profiles/ProfilePanel'
import { VideoOverlay } from './video/VideoOverlay'

export default function App() {
  return (
    <ErrorBoundary>
      <MapScene />
      <TimelineBar />
      <Subtitle />
      <GeneralButtons />
      <VideoOverlay />
      <ProfilePanel />
      <OrientationNotice />
      <Loader />
    </ErrorBoundary>
  )
}
