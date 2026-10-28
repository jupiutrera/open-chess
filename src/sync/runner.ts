/**
 * Runs one job at a time; a call while it runs joins that run.
 * invalidate() marks the current run stale: the job must not commit cursors once `stale()` is true,
 * and it is started again when it ends, so the reset state is actually used.
 */
export function serialRunner(job: (stale: () => boolean) => Promise<void>, canRerun: () => boolean = () => true) {
  let generation = 0
  let running: Promise<void> | null = null
  return {
    run(): Promise<void> {
      running ??= (async () => {
        let gen: number
        do {
          gen = generation
          await job(() => gen !== generation)
        } while (gen !== generation && canRerun())
      })().finally(() => (running = null))
      return running
    },
    invalidate() {
      generation++
    },
  }
}
