import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { CheckCircle, CaretRight } from '@phosphor-icons/react'
import { PageHeader, Panel } from '../../ui/kit'
import { CATEGORIES, LESSONS } from './lessonData'
import { db } from '../../db/db'
import { useSettings } from '../../settings'
import { Board } from '../../board/Board'

export default function Lessons() {
  const { t } = useTranslation()
  const lang = useSettings((s) => s.lang)
  const progress = useLiveQuery(() => db.lessonProgress.filter((p) => !p.deleted).toArray(), [])
  const done = new Set(progress?.filter((p) => p.completed).map((p) => p.lessonId))
  const total = LESSONS.length
  const completed = LESSONS.filter((l) => done.has(l.id)).length
  const next = LESSONS.find((l) => !done.has(l.id))

  return (
    <div className="mx-auto max-w-5xl pb-8">
      <PageHeader title={t('lessons.title')} right={<span className="tabular text-[14px] font-semibold text-fg-3">{completed}/{total}</span>} />
      <div className="px-4 lg:px-6">
        {next && (
          <Link to={`/lessons/${next.id}`} className="group mb-5 block">
            <Panel className="grid items-center gap-4 overflow-hidden p-4 transition-colors duration-150 group-hover:bg-raise sm:grid-cols-[180px_1fr]">
              <div className="pointer-events-none hidden sm:block">
                <Board fen={next.steps[0].fen} orientation={next.steps[0].fen.split(' ')[1] === 'b' ? 'black' : 'white'} />
              </div>
              <div>
                <div className="text-[13px] font-bold text-fg-3">{t(`lessons.category.${next.category}`)}</div>
                <div className="text-[22px] font-extrabold">{next.title[lang]}</div>
                <p className="mt-1 max-w-[60ch] text-fg-2">{next.intro[lang]}</p>
                <span className="btn btn-primary mt-3">{completed ? t('lessons.continue') : t('lessons.start')}</span>
              </div>
            </Panel>
          </Link>
        )}
        {CATEGORIES.map((cat) => (
          <section key={cat} className="mb-5">
            <h2 className="mb-2 text-[16px] font-extrabold">{t(`lessons.category.${cat}`)}</h2>
            <Panel className="divide-y divide-line overflow-hidden">
              {LESSONS.filter((l) => l.category === cat).map((l) => (
                <Link key={l.id} to={`/lessons/${l.id}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors duration-150 hover:bg-raise">
                  {done.has(l.id) ? (
                    <CheckCircle size={24} weight="fill" className="shrink-0 text-accent" />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-raise-2" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-bold">{l.title[lang]}</div>
                    <div className="truncate text-[13px] text-fg-3">{l.intro[lang]}</div>
                  </div>
                  <span className="tabular text-[12px] text-fg-3">{l.steps.length}</span>
                  <CaretRight size={18} className="text-fg-3" />
                </Link>
              ))}
            </Panel>
          </section>
        ))}
      </div>
    </div>
  )
}
