import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PageHeader, Panel } from './kit'

/** Any route the app doesn't know, e.g. an old or mistyped link. */
export function NotFound() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  // a passive effect runs after Layout's layout-effect title, so this one wins
  useEffect(() => {
    document.title = `${t('common.notFoundTitle')} · Open Chess`
  }, [t, pathname])
  return (
    <div className="mx-auto max-w-2xl pb-8">
      <PageHeader title={t('common.notFoundTitle')} />
      <div className="px-4 lg:px-6">
        <Panel className="grid justify-items-start gap-4 p-5">
          <p className="text-[15px] text-fg-2">{t('common.notFoundBody')}</p>
          <Link to="/" className="btn btn-primary">
            {t('common.goHome')}
          </Link>
        </Panel>
      </div>
    </div>
  )
}
