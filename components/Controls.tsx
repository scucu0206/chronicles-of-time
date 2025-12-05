
import React, { useRef, useState } from 'react';
import { Sentiment } from '../types';

interface ControlsProps {
  onUpload: (file: File) => void;
  density: number;
  setDensity: (val: number) => void;
  size: number;
  setSize: (val: number) => void;
  textSize: number;
  setTextSize: (val: number) => void;
  isRecording: boolean;
  toggleRecording: () => void;
  sentiment: Sentiment;
  handActive: boolean;
  transcript: string;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onSaveMemory: () => void;
  onToggleView: () => void;
  viewMode: 'LIVE' | 'PALACE';
  saveStatus: 'idle' | 'saving' | 'saved';
  searchResultsCount?: number;
}

export const Controls: React.FC<ControlsProps> = ({
  onUpload,
  density,
  setDensity,
  size,
  setSize,
  textSize,
  setTextSize,
  isRecording,
  toggleRecording,
  sentiment,
  handActive,
  transcript,
  videoRef,
  onSaveMemory,
  onToggleView,
  viewMode,
  saveStatus,
  searchResultsCount
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showSettings, setShowSettings] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUpload(e.target.files[0]);
    }
  };

  // Helper to render consistent circular buttons
  const ActionButton = ({ 
    icon, 
    label, 
    onClick, 
    active = false, 
    disabled = false,
    color = "white"
  }: { 
    icon: React.ReactNode, 
    label: string, 
    onClick: () => void, 
    active?: boolean,
    disabled?: boolean,
    color?: string
  }) => (
    <div className="flex flex-col items-center gap-2 group pointer-events-auto">
        <button 
            onClick={onClick}
            disabled={disabled}
            className={`
                w-14 h-14 md:w-16 md:h-16 rounded-full border flex items-center justify-center 
                transition-all duration-300 active:scale-95 backdrop-blur-md shadow-lg
                ${active 
                    ? `border-${color}-400 bg-${color}-400/20 shadow-[0_0_20px_rgba(255,255,255,0.3)]` 
                    : 'border-white/20 bg-black/40 hover:border-white/60 hover:bg-white/10'
                }
                ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
            `}
        >
            <div className={`transition-colors drop-shadow-[0_0_5px_rgba(255,255,255,0.8)] ${active ? `text-${color}-400` : 'text-white/90'}`}>
                {icon}
            </div>
        </button>
        <span className={`text-[9px] md:text-[10px] font-bold tracking-widest uppercase transition-colors drop-shadow-[0_0_4px_rgba(0,0,0,0.8)] ${active ? `text-${color}-300` : 'text-white/60 group-hover:text-white/90'}`}>
            {label}
        </span>
    </div>
  );

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-6 md:p-8 z-50 font-sans tracking-widest text-white selection:bg-white/30 overflow-hidden">
      
      {/* --- TOP HEADER --- */}
      <div className="flex justify-between items-start md:items-center pointer-events-auto relative">
        {/* Logo / Title */}
        <div className="flex flex-col z-10">
            <h1 className="text-lg md:text-xl font-bold tracking-[0.2em] opacity-90 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]">
              拾光纪
            </h1>
            <span className="text-[8px] md:text-[10px] opacity-60 tracking-[0.3em] mt-1 drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">CHRONICLES OF TIME</span>
        </div>

        {/* Center Navigation */}
        <div className="absolute left-1/2 transform -translate-x-1/2 top-0 md:top-auto flex gap-6 md:gap-12 text-[10px] md:text-xs font-medium opacity-90 pt-1 md:pt-0">
            <button 
                onClick={viewMode === 'PALACE' ? onToggleView : undefined}
                className={`transition-all duration-500 hover:opacity-100 hover:tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] ${viewMode === 'LIVE' ? 'text-white border-b border-white/80 pb-1' : 'text-white/40'}`}
            >
                MEMORY
            </button>
            <button 
                onClick={viewMode === 'LIVE' ? onToggleView : undefined}
                className={`transition-all duration-500 hover:opacity-100 hover:tracking-widest drop-shadow-[0_0_5px_rgba(255,255,255,0.5)] ${viewMode === 'PALACE' ? 'text-white border-b border-white/80 pb-1' : 'text-white/40'}`}
            >
                THE GARDEN
            </button>
        </div>

        {/* Right Status Icons */}
        <div className="flex items-center gap-4 md:gap-6 z-10">
            {/* Hand Tracking Status */}
            <div className={`hidden md:flex items-center gap-2 text-[10px] font-semibold drop-shadow-[0_0_4px_rgba(0,0,0,0.5)] ${handActive ? 'text-emerald-400' : 'text-rose-400/50'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${handActive ? 'bg-emerald-400 animate-pulse box-shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-rose-400'}`}></div>
                {handActive ? 'HAND ON' : 'NO HAND'}
            </div>
            
            {/* Camera Preview */}
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full overflow-hidden border border-white/40 relative opacity-80 hover:opacity-100 transition-opacity pointer-events-none bg-black shadow-[0_0_10px_rgba(255,255,255,0.2)]">
                 <video 
                    ref={videoRef as React.RefObject<HTMLVideoElement>} 
                    className="w-full h-full object-cover transform scale-x-[-1]" 
                    muted 
                    playsInline 
                />
            </div>
        </div>
      </div>

      {/* --- CENTER STATUS PILL --- */}
      <div className="absolute top-20 md:top-24 left-1/2 transform -translate-x-1/2 pointer-events-none w-full flex flex-col items-center">
          {isRecording ? (
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-red-500/40 bg-red-500/10 backdrop-blur-sm animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500"></div>
                  <span className="text-[10px] text-red-100 font-bold tracking-widest drop-shadow-[0_0_4px_rgba(239,68,68,0.5)]">LISTENING...</span>
              </div>
          ) : (
              <div className={`flex items-center gap-3 px-4 py-1.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm transition-all duration-1000 ${sentiment !== Sentiment.NEUTRAL ? 'opacity-100' : 'opacity-0'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${sentiment === Sentiment.POSITIVE ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]'}`}></div>
                  <span className="text-[10px] text-white/80 font-bold tracking-widest uppercase drop-shadow-[0_0_4px_rgba(255,255,255,0.3)]">Gemini: {sentiment}</span>
              </div>
          )}
          
          {viewMode === 'PALACE' && searchResultsCount !== undefined && searchResultsCount > 0 && (
             <div className="mt-4 text-center">
                <span className="text-yellow-200 text-xs font-bold tracking-widest border-b border-yellow-200/50 pb-1 drop-shadow-[0_0_8px_rgba(253,224,71,0.5)]">
                    FOUND {searchResultsCount} MEMORIES
                </span>
             </div>
          )}
      </div>

      {/* --- BOTTOM CONTROLS STACK --- */}
      <div className="flex flex-col items-center w-full relative pointer-events-none pb-6 md:pb-10 mt-auto gap-4">
        
        {/* 1. Transcript Area */}
        <div className="w-full text-center pointer-events-none px-4 min-h-[30px] mb-2">
            {saveStatus !== 'idle' ? (
                <span className={`text-xs md:text-sm font-bold tracking-widest drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] ${saveStatus === 'saving' ? 'text-blue-300 animate-pulse' : 'text-emerald-300'}`}>
                    {saveStatus === 'saving' ? 'SAVING MEMORY...' : 'MEMORY SAVED'}
                </span>
            ) : (
                transcript && (
                    <p className="text-sm md:text-lg font-medium text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.8)] line-clamp-2">
                        {transcript}
                    </p>
                )
            )}
        </div>

        {/* 2. Settings Drawer (Slide Up) */}
        <div className={`w-full max-w-sm transition-all duration-500 pointer-events-auto overflow-hidden ${showSettings ? 'max-h-48 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}>
            <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col gap-4 mx-4">
                 {viewMode === 'LIVE' ? (
                    <>
                        <div className="group flex flex-col gap-1">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-white/60 tracking-widest">DENSITY</span>
                                <span className="text-[9px] text-white/40">{density}</span>
                            </div>
                            <input 
                                type="range" min="10000" max="200000" step="5000" value={density}
                                onChange={(e) => setDensity(Number(e.target.value))}
                                className="w-full h-[2px] bg-white/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                            />
                        </div>
                        <div className="group flex flex-col gap-1">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-white/60 tracking-widest">PARTICLE SIZE</span>
                                <span className="text-[9px] text-white/40">{size}</span>
                            </div>
                            <input 
                                type="range" min="0.05" max="1.0" step="0.05" value={size}
                                onChange={(e) => setSize(Number(e.target.value))}
                                className="w-full h-[2px] bg-white/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                            />
                        </div>
                        <div className="group flex flex-col gap-1">
                            <div className="flex justify-between items-end">
                                <span className="text-[9px] font-bold text-white/60 tracking-widest">TEXT SCALE</span>
                                <span className="text-[9px] text-white/40">{textSize}</span>
                            </div>
                            <input 
                                type="range" min="1.0" max="5.0" step="0.1" value={textSize}
                                onChange={(e) => setTextSize(Number(e.target.value))}
                                className="w-full h-[2px] bg-white/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,255,255,0.8)]"
                            />
                        </div>
                    </>
                 ) : (
                     <div className="text-center text-[10px] text-white/40 italic">
                         Settings unavailable in Memory Garden
                     </div>
                 )}
            </div>
        </div>

        {/* 3. Tune Toggle Button */}
        <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`pointer-events-auto p-2 rounded-full transition-all duration-300 ${showSettings ? 'text-white bg-white/10' : 'text-white/40 hover:text-white'}`}
        >
            <span className="material-symbols-outlined text-lg font-light drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]">
                {showSettings ? 'keyboard_arrow_down' : 'tune'}
            </span>
        </button>

        {/* 4. Main Action Buttons Row */}
        <div className="flex items-end justify-center gap-8 md:gap-16 pointer-events-auto">
            
            {/* Upload */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            <ActionButton 
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11 15h2V9h3l-4-5-4 5h3z"/>
                    <path d="M20 18H4v-7H2v7c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2v-7h-2v7z"/>
                  </svg>
                }
                label="Upload" 
                onClick={() => fileInputRef.current?.click()} 
            />

            {/* Microphone */}
            <ActionButton 
                icon={isRecording ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                  </svg>
                )}
                label={isRecording ? "Stop" : "Speak"}
                onClick={toggleRecording} 
                active={isRecording}
                color={isRecording ? "white" : undefined}
            />

            {/* Save (Book) */}
            <ActionButton 
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                     <path d="M20 2H8c-1.103 0-2 .897-2 2v12c0 1.103.897 2 2 2h12c1.103 0 2-.897 2-2V4c0-1.103-.897-2-2-2zm0 14H8V4h12v12z"/>
                     <path d="M4 22h14v-2H4V6H2v14c0 1.103.897 2 2 2z"/>
                  </svg>
                }
                label="Save" 
                onClick={onSaveMemory}
                disabled={saveStatus !== 'idle'}
            />

        </div>
      </div>

    </div>
  );
};
