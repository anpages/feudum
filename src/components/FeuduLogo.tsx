interface Props {
  variant?: 'icon' | 'full'
  height?: number
  className?: string
}

export function FeuduLogo({ variant = 'full', height = 36, className = '' }: Props) {
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 100 100"
        height={height}
        width={height}
        className={className}
        aria-label="Feudum"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="sw-a" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e8c547" />
            <stop offset="100%" stopColor="#8a6e1a" />
          </linearGradient>
          <linearGradient id="sw-b" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#e8c547" />
            <stop offset="100%" stopColor="#8a6e1a" />
          </linearGradient>
        </defs>
        {/* Sword left-to-right */}
        <line x1="18" y1="18" x2="82" y2="82" stroke="url(#sw-a)" strokeWidth="7" strokeLinecap="round" />
        <polygon points="74,68 88,88 68,76" fill="url(#sw-a)" />
        <line x1="32" y1="48" x2="52" y2="28" stroke="url(#sw-a)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="18" cy="18" r="8" fill="url(#sw-a)" />
        {/* Sword right-to-left */}
        <line x1="82" y1="18" x2="18" y2="82" stroke="url(#sw-b)" strokeWidth="7" strokeLinecap="round" />
        <polygon points="26,68 12,88 32,76" fill="url(#sw-b)" />
        <line x1="68" y1="48" x2="48" y2="28" stroke="url(#sw-b)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="82" cy="18" r="8" fill="url(#sw-b)" />
        {/* Center gem */}
        <circle cx="50" cy="50" r="7" fill="#c9a227" stroke="#e8c547" strokeWidth="2" />
      </svg>
    )
  }

  // full: swords + FEUDUM + MMXXVI
  const h = height
  const w = Math.round(h * 5.2)
  const iconSize = h
  const fontSize = Math.round(h * 0.72)
  const subSize = Math.round(h * 0.22)
  const textX = iconSize + Math.round(h * 0.42)
  const textY = Math.round(h * 0.68)
  const subY = Math.round(h * 0.92)
  const divX = iconSize + Math.round(h * 0.18)

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      height={h}
      width={w}
      className={className}
      aria-label="Feudum"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="fl-a" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#e8c547" />
          <stop offset="100%" stopColor="#8a6e1a" />
        </linearGradient>
        <linearGradient id="fl-b" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8c547" />
          <stop offset="100%" stopColor="#8a6e1a" />
        </linearGradient>
        <linearGradient id="fl-t" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8c547" />
          <stop offset="100%" stopColor="#9a7820" />
        </linearGradient>
      </defs>

      {/* Swords icon */}
      <g transform={`scale(${h / 100})`}>
        <line x1="18" y1="18" x2="82" y2="82" stroke="url(#fl-a)" strokeWidth="7" strokeLinecap="round" />
        <polygon points="74,68 88,88 68,76" fill="url(#fl-a)" />
        <line x1="32" y1="48" x2="52" y2="28" stroke="url(#fl-a)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="18" cy="18" r="8" fill="url(#fl-a)" />
        <line x1="82" y1="18" x2="18" y2="82" stroke="url(#fl-b)" strokeWidth="7" strokeLinecap="round" />
        <polygon points="26,68 12,88 32,76" fill="url(#fl-b)" />
        <line x1="68" y1="48" x2="48" y2="28" stroke="url(#fl-b)" strokeWidth="6" strokeLinecap="round" />
        <circle cx="82" cy="18" r="8" fill="url(#fl-b)" />
        <circle cx="50" cy="50" r="7" fill="#c9a227" stroke="#e8c547" strokeWidth="2" />
      </g>

      {/* Divider */}
      <line
        x1={divX} y1={Math.round(h * 0.12)}
        x2={divX} y2={Math.round(h * 0.88)}
        stroke="#c9a227" strokeWidth="1" strokeOpacity="0.35"
      />

      {/* FEUDUM */}
      <text
        x={textX} y={textY}
        fontFamily="Cinzel, Georgia, serif"
        fontSize={fontSize}
        fontWeight="700"
        letterSpacing="2"
        fill="url(#fl-t)"
      >
        FEUDUM
      </text>

      {/* MMXXVI */}
      <text
        x={textX + 2} y={subY}
        fontFamily="Cinzel, Georgia, serif"
        fontSize={subSize}
        letterSpacing="4"
        fill="#c9a227"
        fillOpacity="0.5"
      >
        MMXXVI
      </text>
    </svg>
  )
}
