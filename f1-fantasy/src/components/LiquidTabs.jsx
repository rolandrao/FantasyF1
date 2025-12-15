import { motion } from "framer-motion";

// Added 'layoutId' to props with a default value
const LiquidTabs = ({ options, activeId, onChange, className = "", layoutId = "liquid-pill" }) => {
  return (
    <div className={`flex bg-black/60 backdrop-blur-xl p-1 rounded-2xl border border-white/10 ${className}`}>
      {options.map((option) => {
        const isActive = activeId === option.id;
        
        return (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            className={`
              relative flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-xl transition-colors z-0
              ${isActive ? "text-white" : "text-white/40 hover:text-white/60"}
            `}
            style={{ WebkitTapHighlightColor: "transparent" }}
          >
            <span className="relative z-10">{option.label}</span>

            {isActive && (
              <motion.div
                // USE THE PROP HERE instead of a hardcoded string
                layoutId={layoutId} 
                className="absolute inset-0 bg-neutral-700/80 shadow-inner rounded-xl border border-white/10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default LiquidTabs;