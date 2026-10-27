import { PieceIcon } from '../board/QualityIcon'

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[22%] bg-accent shadow-[0_2px_0_0_var(--accent-lo)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <PieceIcon piece="n" color="w" size={size * 0.82} />
    </span>
  )
}
