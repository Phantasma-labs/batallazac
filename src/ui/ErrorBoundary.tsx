import { Component, type ReactNode } from 'react'
import { t } from '../i18n'

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
        <h1 style={{ fontSize: 20 }}>{t('No se pudo cargar la escena', 'Could not load the scene')}</h1>
        <p>{error.message}</p>
        <p>
          {t('Si falta un modelo o una textura: reexportalo desde Blender, ejecuta', 'If a model or texture is missing: re-export it from Blender, run')} <code>npm run sync-assets</code>,{' '}
          {t('verifica que su nombre coincida con', 'make sure its name matches')} <code>src/scene/assets.json</code>
          {t(' y recarga esta página.', ', then reload this page.')}
        </p>
      </div>
    )
  }
}
