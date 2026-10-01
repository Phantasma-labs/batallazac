import { Component, type ReactNode } from 'react'

/** A missing or unreadable asset should say so, not leave a blank canvas. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div role="alert" style={{ padding: 24, font: '16px/1.5 system-ui, sans-serif', color: '#3b3224' }}>
        <h1 style={{ fontSize: 20 }}>Could not load the scene</h1>
        <p>{error.message}</p>
        <p>
          If a model or texture is missing, re-export it from Blender and run <code>npm run sync-assets</code>.
        </p>
      </div>
    )
  }
}
