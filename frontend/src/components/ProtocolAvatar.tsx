import React from 'react'

const PALETTE = [
  'from-indigo-500 to-blue-600',
  'from-violet-500 to-purple-600',
  'from-sky-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-rose-500 to-pink-600',
]

function pickGradient(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

interface ProtocolAvatarProps {
  name: string
  iconData?: string
  size?: 'sm' | 'md' | 'lg'
}

export const ProtocolAvatar: React.FC<ProtocolAvatarProps> = ({
  name,
  iconData,
  size = 'md',
}) => {
  const sizeClass =
    size === 'lg'
      ? 'w-12 h-12 rounded-2xl text-lg'
      : size === 'sm'
        ? 'w-8 h-8 rounded-lg text-xs'
        : 'w-10 h-10 rounded-xl text-sm'

  if (iconData) {
    return (
      <div
        className={`${sizeClass} shrink-0 flex items-center justify-center bg-white dark:bg-[#1C222B] border border-slate-200/80 dark:border-slate-700/70 shadow-sm overflow-hidden p-1.5`}
      >
        <img
          src={iconData}
          alt={name}
          className="w-full h-full object-contain"
          draggable={false}
        />
      </div>
    )
  }

  const initial = (name.trim()[0] || '?').toUpperCase()
  const gradient = pickGradient(name)

  return (
    <div
      className={`${sizeClass} shrink-0 flex items-center justify-center bg-gradient-to-br ${gradient} text-white font-semibold shadow-sm tracking-wide`}
    >
      {initial}
    </div>
  )
}
