import React, { useEffect, useState } from 'react';

interface ReadingOverlayProps {
  text: string;
  timestamp?: number; // New prop for date
  onClose: () => void;
}

export const ReadingOverlay: React.FC<ReadingOverlayProps> = ({ text, timestamp, onClose }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger fade-in animation
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 500); // Wait for fade-out
  };

  // Format Date
  const dateString = timestamp ? new Date(timestamp).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
  }) : new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
  });

  return (
    <div 
      onClick={handleClose}
      className={`fixed inset-0 z-[100] flex items-center justify-center cursor-pointer transition-all duration-700 ${visible ? 'bg-black/60 backdrop-blur-xl opacity-100' : 'bg-black/0 backdrop-blur-none opacity-0'}`}
    >
      <div className={`max-w-4xl w-full p-8 md:p-12 text-center transition-all duration-1000 transform ${visible ? 'scale-100 translate-y-0 blur-none' : 'scale-90 translate-y-10 blur-sm'}`}>
        
        {/* Date Header */}
        <div className="mb-8 opacity-60">
            <p className="text-sm tracking-[0.2em] text-emerald-200/80 font-light border-b border-emerald-500/20 inline-block pb-2">
                {dateString}
            </p>
        </div>

        {/* Decorative Quote Icon */}
        <div className="text-6xl text-white/10 font-serif mb-6 select-none">“</div>
        
        {/* Main Text Content */}
        <div className="max-h-[60vh] overflow-y-auto pr-4 scrollbar-hide">
            <p className="text-xl md:text-3xl lg:text-4xl font-light leading-relaxed text-white/90 tracking-wide drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] font-sans whitespace-pre-wrap">
            {text}
            </p>
        </div>

        {/* Footer */}
        <div className="mt-12 flex flex-col items-center gap-4">
            <div className="w-12 h-[1px] bg-gradient-to-r from-transparent via-white/30 to-transparent"></div>
            <p className="text-[10px] text-white/30 tracking-[0.4em] uppercase hover:text-white/60 transition-colors">
                Tap anywhere to close
            </p>
        </div>

      </div>
    </div>
  );
};