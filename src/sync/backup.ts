import type { CloneRow } from '../db/db'

/**
 * The clones of a backup file. Older backups have none (undefined is fine); anything else must be
 * a list of rows with the fields the clones table is keyed and sorted by, so a bad file changes nothing.
 */
export function readBackupClones(raw: unknown): CloneRow[] {
  if (raw === undefined) return []
  if (!Array.isArray(raw)) throw new Error('bad clones')
  for (const c of raw as Partial<CloneRow>[]) {
    if (typeof c?.id !== 'string' || typeof c.createdAt !== 'number' || typeof c.name !== 'string' || typeof c.book !== 'object' || !c.book) {
      throw new Error('bad row in clones')
    }
  }
  return raw as CloneRow[]
}
