import { motion } from 'framer-motion'

const AnimatedTabs = ({ options, activeId, onChange, className = '' }) => {
  return (
    <div className={`flex space-x-1 bg-neutral-800/50 backdrop-blur-md p-1 rounded-full border border-neutral-700/50 ${className}`}>
      {options.map((option) => {
        const isActive = activeId === option.id

        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`${
              isActive ? 'text-white' : 'text-gray-400 hover:text-gray-200'
            } relative rounded-full px-4 py-2 text-sm font-bold transition focus-visible:outline-2`}
            style={{
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {/* The Active Pill Background */}
            {isActive && (
              <motion.div
                layoutId="active-pill"
                className="absolute inset-0 bg-neutral-600 rounded-full"
                // iOS-like spring physics
                transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }} 
                style={{ borderRadius: 9999 }} // Ensures full rounded
              />
            )}

            {/* The Text (Must be relative/z-10 to sit ON TOP of the pill) */}
            <span className="relative z-10 mix-blend-normal">
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default AnimatedTabs