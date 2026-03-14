/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Pizza, 
  User, 
  Star, 
  ChevronRight, 
  RotateCcw, 
  Trophy, 
  Calculator, 
  Info,
  CheckCircle2,
  AlertCircle,
  Heart,
  History,
  Play,
  Music,
  Music2
} from 'lucide-react';

// --- Constants & Types ---

const PALETTE = {
  tomato: '#C0392B',
  cream: '#FFF8E7',
  brown: '#3E1F00',
  cheese: '#F0C040',
  olive: '#6B7C3A',
  white: '#FFFFFF',
  red: '#E74C3C',
};

type Level = {
  id: number;
  name: string;
  rStep: number;
  thetaStep: number;
  margin: number;
  multiplier: number;
};

const LEVELS: Level[] = [
  { id: 1, name: 'Aprendiz', rStep: 1, thetaStep: 1, margin: 15, multiplier: 1 },
  { id: 2, name: 'Pizzero', rStep: 0.5, thetaStep: 1, margin: 8, multiplier: 1.5 },
  { id: 3, name: 'Maestro', rStep: 0.5, thetaStep: 1, margin: 3, multiplier: 2.5 },
];

type Customer = {
  id: number;
  name: string;
  emoji: string;
  personality: string;
  color: string;
};

const CUSTOMERS: Customer[] = [
  { id: 1, name: 'Luigi', emoji: '👨‍🍳', personality: 'Amigable y tradicional.', color: '#C0392B' },
  { id: 2, name: 'Sofia', emoji: '👩‍🔬', personality: 'Precisa y amante de la geometría.', color: '#2980B9' },
  { id: 3, name: 'Marco', emoji: '👨‍💼', personality: 'Impaciente, le gustan las pizzas grandes.', color: '#27AE60' },
  { id: 4, name: 'Giulia', emoji: '👩‍🎨', personality: 'Experimental, prefiere ángulos curiosos.', color: '#8E44AD' },
];

type Order = {
  targetR: number;
  targetTheta: number;
  customer: Customer;
};

// --- Helper Components ---

const StarRating = ({ rating }: { rating: number }) => {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <motion.div
          key={s}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: s * 0.1 }}
        >
          <Star 
            size={24} 
            fill={s <= rating ? PALETTE.cheese : 'transparent'} 
            color={s <= rating ? PALETTE.cheese : '#ccc'} 
            className={s <= rating ? 'drop-shadow-glow' : ''}
          />
        </motion.div>
      ))}
    </div>
  );
};

// --- Sound Utility ---

const playSound = (type: 'arrival' | 'delivery' | 'success' | 'fail' | 'levelUp') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'arrival':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'delivery':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.linearRampToValueAtTime(600, now + 0.3);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'success':
      // Arpeggio
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.1);
        g.gain.setValueAtTime(0.1, now + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.3);
        o.start(now + i * 0.1);
        o.stop(now + i * 0.1 + 0.3);
      });
      break;
    case 'fail':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(110, now);
      osc.frequency.linearRampToValueAtTime(55, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
    case 'levelUp':
      // Fanfare
      [523.25, 523.25, 523.25, 698.46].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g);
        g.connect(ctx.destination);
        o.frequency.setValueAtTime(freq, now + i * 0.15);
        g.gain.setValueAtTime(0.1, now + i * 0.15);
        g.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.4);
        o.start(now + i * 0.15);
        o.stop(now + i * 0.15 + 0.4);
      });
      break;
  }
};

// --- Main Component ---

export default function App() {
  // Game State
  const [levelIdx, setLevelIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [totalStars, setTotalStars] = useState(0);
  const [ordersCompleted, setOrdersCompleted] = useState(0);
  const [correctOrdersInLevel, setCorrectOrdersInLevel] = useState(0);
  const [currentOrder, setCurrentOrder] = useState<Order & { targetArcLength?: number } | null>(null);
  const [gameState, setGameState] = useState<'start' | 'playing' | 'feedback' | 'levelUp' | 'history' | 'gameOver'>('start');
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [infiniteUnlocked, setInfiniteUnlocked] = useState(false);
  const [isInfiniteMode, setIsInfiniteMode] = useState(false);
  const [lives, setLives] = useState(3);
  const [infiniteSuccessCount, setInfiniteSuccessCount] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  
  // Player Controls
  const [playerR, setPlayerR] = useState(8);
  const [playerTheta, setPlayerTheta] = useState(90);
  
  // Feedback State
  const [feedback, setFeedback] = useState<{
    stars: number;
    message: string;
    errorR: number;
    errorTheta: number;
    errorArc?: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentLevel = LEVELS[levelIdx];

  // --- Logic ---

  useEffect(() => {
    // This effect now only handles cleanup and state-based pausing
    if (!isMusicPlaying && audioRef.current) {
      audioRef.current.pause();
    }
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isMusicPlaying]);

  const generateOrder = (forcedLevelIdx?: number) => {
    let activeLevelIdx = forcedLevelIdx !== undefined ? forcedLevelIdx : levelIdx;
    
    // If infinite mode, randomly pick Level 2 or Level 3 logic
    if (isInfiniteMode) {
      activeLevelIdx = Math.random() > 0.5 ? 1 : 2;
      setLevelIdx(activeLevelIdx);
    }

    const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
    let targetR, targetTheta, targetArcLength;

    if (activeLevelIdx === 0) {
      // Level 1: R and Theta
      targetR = Math.floor(Math.random() * (15 - 3 + 1)) + 3;
      targetTheta = (Math.floor(Math.random() * (36 - 1 + 1)) + 1) * 10;
    } else if (activeLevelIdx === 1) {
      // Level 2: R and Arc Length (Find Theta)
      targetR = (Math.floor(Math.random() * (15 - 3) * 2) + 3 * 2) / 2;
      targetTheta = Math.floor(Math.random() * (350 - 10 + 1)) + 10;
      targetArcLength = (targetTheta / 360) * 2 * Math.PI * targetR;
    } else {
      // Level 3: Arc Length and Theta (Find R)
      targetR = (Math.floor(Math.random() * (15 - 3) * 2) + 3 * 2) / 2;
      targetTheta = Math.floor(Math.random() * (350 - 10 + 1)) + 10;
      targetArcLength = (targetTheta / 360) * 2 * Math.PI * targetR;
    }

    setCurrentOrder({ targetR, targetTheta, customer, targetArcLength });
    setPlayerR(8);
    setPlayerTheta(90);
    setGameState('playing');
    playSound('arrival');
  };

  const startGame = (infinite = false) => {
    setScore(0);
    setTotalStars(0);
    setOrdersCompleted(0);
    setCorrectOrdersInLevel(0);
    setOrderHistory([]);
    setIsInfiniteMode(infinite);
    setIsMusicPlaying(true);

    // Ensure audio starts on user interaction
    if (!audioRef.current) {
      audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7315b.mp3');
      audioRef.current.loop = true;
      audioRef.current.volume = 0.1;
    }
    audioRef.current.play().catch(e => console.log("Audio play blocked", e));

    if (infinite) {
      setLives(3);
      setInfiniteSuccessCount(0);
      setLevelIdx(1); // Infinite mode uses L2 and L3 logic
      generateOrder(1);
    } else {
      setLevelIdx(0);
      generateOrder(0);
    }
  };

  const deliverPizza = () => {
    if (!currentOrder) return;
    playSound('delivery');

    let stars = 1;
    let message = "";
    let errorR = (Math.abs(playerR - currentOrder.targetR) / currentOrder.targetR) * 100;
    let errorTheta = (Math.abs(playerTheta - currentOrder.targetTheta) / currentOrder.targetTheta) * 100;
    let errorArc = 0;
    let finalError = 0;

    if (levelIdx === 2) {
      const playerArc = (playerTheta / 360) * 2 * Math.PI * playerR;
      errorArc = (Math.abs(playerArc - currentOrder.targetArcLength!) / currentOrder.targetArcLength!) * 100;
      finalError = (errorArc + errorTheta) / 2;
    } else if (levelIdx === 1) {
      const playerArc = (playerTheta / 360) * 2 * Math.PI * playerR;
      errorArc = (Math.abs(playerArc - currentOrder.targetArcLength!) / currentOrder.targetArcLength!) * 100;
      finalError = (errorArc + errorR) / 2;
    } else {
      finalError = (errorR + errorTheta) / 2;
    }

    if (finalError <= 2) {
      stars = 5;
      message = "¡Perfecto! ¡Eres un maestro pizzero!";
    } else if (finalError <= 6) {
      stars = 4;
      message = "¡Muy bien! Casi perfecto.";
    } else if (finalError <= 12) {
      stars = 3;
      message = "Aceptable, pero puedes mejorar.";
    } else if (finalError <= 20) {
      stars = 2;
      message = "Hmm... no era exactamente esto.";
    } else {
      stars = 1;
      message = "¡Esto no es lo que pedí! 😤";
    }

    const isSuccess = stars >= 4;
    if (isSuccess) {
      setCorrectOrdersInLevel(prev => prev + 1);
      if (isInfiniteMode) setInfiniteSuccessCount(prev => prev + 1);
      playSound('success');
    } else {
      if (isInfiniteMode) {
        setLives(prev => {
          const newLives = prev - 1;
          if (newLives <= 0) {
            setTimeout(() => setGameState('gameOver'), 1500);
          }
          return newLives;
        });
      }
      playSound('fail');
    }

    const points = stars * 100 * (isInfiniteMode ? 2 : currentLevel.multiplier);
    setScore(prev => prev + points);
    setTotalStars(prev => prev + stars);
    setOrdersCompleted(prev => prev + 1);
    
    const historyEntry = {
      level: isInfiniteMode ? 'Infinito' : currentLevel.name,
      customer: currentOrder.customer,
      targetR: currentOrder.targetR,
      targetTheta: currentOrder.targetTheta,
      targetArc: currentOrder.targetArcLength,
      playerR,
      playerTheta,
      stars,
      success: isSuccess
    };
    setOrderHistory(prev => [...prev, historyEntry]);

    setFeedback({ 
      stars, 
      message, 
      errorR, 
      errorTheta, 
      errorArc: currentOrder.targetArcLength ? errorArc : undefined
    });
    setGameState('feedback');
  };

  const nextOrder = () => {
    if (isInfiniteMode) {
      if (lives > 0) {
        generateOrder();
      } else {
        setGameState('gameOver');
      }
      return;
    }

    if (correctOrdersInLevel >= 3 && levelIdx < LEVELS.length - 1) {
      setGameState('levelUp');
      playSound('levelUp');
    } else if (correctOrdersInLevel >= 3 && levelIdx === LEVELS.length - 1) {
      setGameState('history');
      setInfiniteUnlocked(true);
      playSound('levelUp');
    } else {
      generateOrder();
    }
  };

  const goToNextLevel = () => {
    const nextIdx = levelIdx + 1;
    setLevelIdx(nextIdx);
    setCorrectOrdersInLevel(0);
    generateOrder(nextIdx);
  };

  // --- Calculations for Educational Panel ---
  const radians = useMemo(() => (playerTheta * Math.PI) / 180, [playerTheta]);
  const sectorArea = useMemo(() => (playerTheta / 360) * Math.PI * Math.pow(playerR, 2), [playerTheta, playerR]);
  const arcLength = useMemo(() => (playerTheta / 360) * 2 * Math.PI * playerR, [playerTheta, playerR]);
  const totalArea = useMemo(() => Math.PI * Math.pow(playerR, 2), [playerR]);

  // --- Drawing ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width;
      const h = canvas.height;
      const centerX = w / 2;
      const centerY = h / 2;
      const scale = 12; // pixels per cm

      ctx.clearRect(0, 0, w, h);

      // Draw background board
      ctx.beginPath();
      ctx.arc(centerX, centerY, 16 * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#3E1F00'; // Dark wood
      ctx.fill();
      ctx.strokeStyle = '#2A1500';
      ctx.lineWidth = 8;
      ctx.stroke();

      // Draw wood grain (subtle)
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 2;
      for(let i = 1; i < 16; i += 2) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, i * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw pizza base (Crust)
      ctx.beginPath();
      ctx.arc(centerX, centerY, playerR * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#D35400'; // Toasted crust color
      ctx.fill();
      
      // Draw inner dough/sauce base
      ctx.beginPath();
      ctx.arc(centerX, centerY, (playerR - 0.8) * scale, 0, Math.PI * 2);
      ctx.fillStyle = '#C0392B'; // Tomato Sauce Red
      ctx.fill();

      // Draw sector (Cheese)
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + radians;
      ctx.arc(centerX, centerY, (playerR - 0.8) * scale, startAngle, endAngle);
      ctx.lineTo(centerX, centerY);
      ctx.fillStyle = '#F1C40F'; // Cheese Yellow
      ctx.fill();
      ctx.strokeStyle = '#D4AC0D'; // Darker cheese edge
      ctx.lineWidth = 2;
      ctx.stroke();

      // Draw Pepperonis in the sector
      const pepperoniCount = Math.min(6, Math.max(2, Math.floor(playerTheta / 50)));
      ctx.fillStyle = '#A93226'; // Pepperoni red
      ctx.strokeStyle = '#7B241C'; // Darker edge
      ctx.lineWidth = 1;

      for (let i = 0; i < pepperoniCount; i++) {
        // Better distribution using a fixed offset per pepperoni index
        const angleStep = radians / (pepperoniCount + 1);
        const angle = startAngle + (i + 1) * angleStep;
        
        // Alternate distance for better separation
        const distFactor = i % 2 === 0 ? 0.4 : 0.7;
        const dist = distFactor * (playerR - 1.5) * scale;
        
        const px = centerX + dist * Math.cos(angle);
        const py = centerY + dist * Math.sin(angle);
        
        ctx.beginPath();
        ctx.arc(px, py, 0.6 * scale, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Pepperoni detail
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.beginPath();
        ctx.arc(px - 2, py - 2, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#A93226';
      }

      // Draw labels
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px Inter';
      ctx.textAlign = 'center';
      
      // Radio label
      const midAngle = startAngle + radians / 2;
      const labelX = centerX + (playerR * scale * 0.6) * Math.cos(midAngle);
      const labelY = centerY + (playerR * scale * 0.6) * Math.sin(midAngle);
      ctx.fillText(`r = ${playerR}cm`, labelX, labelY);

      // Angle label
      ctx.fillText(`${playerTheta}°`, centerX, centerY - 20);
    };

    draw();
  }, [playerR, playerTheta, radians]);

  // --- Render ---

  return (
    <div className="min-h-screen bg-[#FFF8E7] font-sans text-[#3E1F00] selection:bg-[#C0392B] selection:text-white">
      {/* Background Pattern */}
      <div className="fixed inset-0 pointer-events-none opacity-10" 
           style={{ backgroundImage: 'linear-gradient(45deg, #C0392B 25%, transparent 25%, transparent 75%, #C0392B 75%, #C0392B), linear-gradient(45deg, #C0392B 25%, transparent 25%, transparent 75%, #C0392B 75%, #C0392B)', backgroundSize: '60px 60px', backgroundPosition: '0 0, 30px 30px' }}>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-[#C0392B] p-3 rounded-2xl shadow-lg rotate-[-5deg]">
              <Pizza color="white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black tracking-tighter uppercase italic text-[#C0392B]">
                Pizzería Geométrica
              </h1>
              <p className="text-sm font-medium opacity-70 uppercase tracking-widest">Trattoria di Matematica</p>
            </div>
          </div>

          <div className="flex gap-6 bg-white/80 backdrop-blur px-6 py-3 rounded-2xl shadow-sm border border-[#3E1F00]/5">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold opacity-50">Nivel</p>
              <p className="text-xl font-black text-[#C0392B]">{currentLevel.name}</p>
            </div>
            <div className="w-px h-8 bg-[#3E1F00]/10 self-center" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold opacity-50">{isInfiniteMode ? 'Vidas' : 'Progreso'}</p>
              <p className="text-xl font-black flex items-center justify-center gap-1">
                {isInfiniteMode ? (
                  <>
                    {[...Array(3)].map((_, i) => (
                      <Heart key={i} size={16} fill={i < lives ? PALETTE.tomato : 'transparent'} color={PALETTE.tomato} />
                    ))}
                  </>
                ) : (
                  `${correctOrdersInLevel}/3`
                )}
              </p>
            </div>
            <div className="w-px h-8 bg-[#3E1F00]/10 self-center" />
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold opacity-50">Puntos</p>
              <p className="text-xl font-black">{score.toLocaleString()}</p>
            </div>
          </div>
        </header>

        {gameState === 'start' ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto bg-white rounded-[2rem] p-12 shadow-2xl border-4 border-[#C0392B] text-center"
          >
            <div className="mb-8 flex justify-center">
              <div className="relative">
                <Pizza size={120} className="text-[#C0392B]" />
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="absolute inset-0 border-4 border-dashed border-[#F0C040] rounded-full"
                />
              </div>
            </div>
            <h2 className="text-3xl font-black mb-4">¡Benvenuti a la Pizzería!</h2>
            <p className="text-lg mb-8 opacity-80">
              Aprende geometría mientras sirves a los clientes más exigentes. 
              Ajusta el radio y el ángulo de cada porción para ganar estrellas.
            </p>
            <div className="flex flex-col gap-4">
              <button 
                onClick={() => startGame(false)}
                className="bg-[#C0392B] text-white px-12 py-4 rounded-full text-xl font-bold shadow-xl hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-3 mx-auto w-full max-w-xs"
              >
                Modo Historia <ChevronRight />
              </button>
              
              {infiniteUnlocked && (
                <button 
                  onClick={() => startGame(true)}
                  className="bg-[#F0C040] text-[#3E1F00] px-12 py-4 rounded-full text-xl font-bold shadow-xl hover:scale-105 transition-transform active:scale-95 flex items-center justify-center gap-3 mx-auto w-full max-w-xs"
                >
                  Modo Infinito <Play />
                </button>
              )}

              <button 
                onClick={() => {
                  const newState = !isMusicPlaying;
                  setIsMusicPlaying(newState);
                  if (newState) {
                    if (!audioRef.current) {
                      audioRef.current = new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a7315b.mp3');
                      audioRef.current.loop = true;
                      audioRef.current.volume = 0.1;
                    }
                    audioRef.current.play().catch(e => console.log("Audio play blocked", e));
                  } else {
                    audioRef.current?.pause();
                  }
                }}
                className="text-xs uppercase font-bold opacity-50 flex items-center justify-center gap-2 hover:opacity-100 transition-opacity"
              >
                {isMusicPlaying ? <Music size={14} /> : <Music2 size={14} />}
                Música: {isMusicPlaying ? 'ON' : 'OFF'}
              </button>
            </div>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: Customer & Controls */}
            <div className="lg:col-span-4 space-y-6">
              {/* Customer Card */}
              <AnimatePresence mode="wait">
                {currentOrder && (
                  <motion.div 
                    key={currentOrder.customer.id}
                    initial={{ x: -50, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 50, opacity: 0 }}
                    className="bg-white rounded-3xl p-6 shadow-lg border-b-4 border-[#3E1F00]/10"
                  >
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-5xl bg-[#FFF8E7] w-20 h-20 flex items-center justify-center rounded-2xl shadow-inner">
                        {currentOrder.customer.emoji}
                      </div>
                      <div>
                        <h3 className="text-xl font-black">{currentOrder.customer.name}</h3>
                        <p className="text-xs opacity-60 italic">{currentOrder.customer.personality}</p>
                      </div>
                    </div>
                    <div className="relative bg-[#FFF8E7] p-4 rounded-2xl border-2 border-dashed border-[#C0392B]/30">
                      <p className="text-lg font-medium leading-tight">
                        {levelIdx === 2 ? (
                          <>
                            "¡Hola! Quiero una pizza con un ángulo de <span className="text-[#C0392B] font-bold">{currentOrder.targetTheta}°</span> y una longitud de arco de <span className="text-[#C0392B] font-bold">{currentOrder.targetArcLength?.toFixed(1)} cm</span>. ¡Encuentra el radio!"
                          </>
                        ) : levelIdx === 1 ? (
                          <>
                            "¡Hola! Quiero una pizza de radio <span className="text-[#C0392B] font-bold">{currentOrder.targetR} cm</span> con una longitud de arco de <span className="text-[#C0392B] font-bold">{currentOrder.targetArcLength?.toFixed(1)} cm</span>. ¡Encuentra el ángulo!"
                          </>
                        ) : (
                          <>
                            "¡Hola! Quiero una pizza de radio <span className="text-[#C0392B] font-bold">{currentOrder.targetR} cm</span> con un ángulo de <span className="text-[#C0392B] font-bold">{currentOrder.targetTheta}°</span>."
                          </>
                        )}
                      </p>
                      <div className="absolute -bottom-2 left-6 w-4 h-4 bg-[#FFF8E7] rotate-45 border-r-2 border-b-2 border-[#C0392B]/30" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Controls */}
              <div className="bg-white rounded-3xl p-8 shadow-lg space-y-8">
                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs uppercase font-black tracking-widest opacity-50">Control de Radio</label>
                    <span className="text-3xl font-black text-[#C0392B]">{playerR}<span className="text-sm ml-1">cm</span></span>
                  </div>
                  <input 
                    type="range" 
                    min="3" 
                    max="15" 
                    step={currentLevel.rStep}
                    value={playerR}
                    onChange={(e) => setPlayerR(parseFloat(e.target.value))}
                    className="w-full h-3 bg-[#FFF8E7] rounded-full appearance-none cursor-pointer accent-[#C0392B]"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-bold opacity-30">
                    <span>3cm</span>
                    <span>15cm</span>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-end mb-4">
                    <label className="text-xs uppercase font-black tracking-widest opacity-50">Ángulo Central</label>
                    <span className="text-3xl font-black text-[#C0392B]">{playerTheta}<span className="text-sm ml-1">°</span></span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="360" 
                    step={currentLevel.thetaStep}
                    value={playerTheta}
                    onChange={(e) => setPlayerTheta(parseInt(e.target.value))}
                    className="w-full h-3 bg-[#FFF8E7] rounded-full appearance-none cursor-pointer accent-[#C0392B]"
                  />
                  <div className="flex justify-between mt-2 text-[10px] font-bold opacity-30">
                    <span>10°</span>
                    <span>360°</span>
                  </div>
                </div>

                <button 
                  onClick={deliverPizza}
                  disabled={gameState !== 'playing'}
                  className="w-full bg-[#C0392B] text-white py-4 rounded-2xl text-lg font-bold shadow-lg hover:bg-[#A93226] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  ¡Entregar Pizza! 🍕
                </button>
              </div>
            </div>

            {/* Center Column: Canvas */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-[2.5rem] p-4 shadow-xl border-8 border-white relative overflow-hidden aspect-square flex items-center justify-center">
                <canvas 
                  ref={canvasRef} 
                  width={500} 
                  height={500}
                  className="w-full h-full max-w-full max-h-full"
                />
                
                {/* Feedback Overlay */}
                <AnimatePresence>
                  {gameState === 'feedback' && feedback && (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
                    >
                      {feedback.stars === 5 && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          {[...Array(20)].map((_, i) => (
                            <motion.div
                              key={i}
                              initial={{ 
                                top: '100%', 
                                left: `${Math.random() * 100}%`,
                                scale: Math.random() * 0.5 + 0.5,
                                rotate: 0
                              }}
                              animate={{ 
                                top: '-10%',
                                rotate: 360,
                                left: `${Math.random() * 100}%`
                              }}
                              transition={{ 
                                duration: Math.random() * 2 + 1,
                                repeat: Infinity,
                                ease: 'easeOut'
                              }}
                              className="absolute w-4 h-4"
                              style={{ 
                                backgroundColor: [PALETTE.tomato, PALETTE.cheese, PALETTE.olive, '#3498DB'][Math.floor(Math.random() * 4)],
                                borderRadius: Math.random() > 0.5 ? '50%' : '2px'
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <motion.div 
                        initial={{ y: 20 }}
                        animate={{ y: 0 }}
                        className="mb-6"
                      >
                        <StarRating rating={feedback.stars} />
                      </motion.div>
                      <h3 className="text-3xl font-black mb-2 text-[#C0392B]">{feedback.message}</h3>
                      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
                        {feedback.errorArc !== undefined ? (
                          <>
                            <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#C0392B]/10">
                              <p className="text-[10px] uppercase font-bold opacity-50">{levelIdx === 2 ? 'Error Ángulo' : 'Error Radio'}</p>
                              <p className="text-lg font-black">{levelIdx === 2 ? feedback.errorTheta.toFixed(1) : feedback.errorR.toFixed(1)}%</p>
                            </div>
                            <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#C0392B]/10">
                              <p className="text-[10px] uppercase font-bold opacity-50">Error de Arco</p>
                              <p className="text-lg font-black">{feedback.errorArc.toFixed(1)}%</p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#C0392B]/10">
                              <p className="text-[10px] uppercase font-bold opacity-50">Error Radio</p>
                              <p className="text-lg font-black">{feedback.errorR.toFixed(1)}%</p>
                            </div>
                            <div className="bg-[#FFF8E7] p-3 rounded-xl border border-[#C0392B]/10">
                              <p className="text-[10px] uppercase font-bold opacity-50">Error Ángulo</p>
                              <p className="text-lg font-black">{feedback.errorTheta.toFixed(1)}%</p>
                            </div>
                          </>
                        )}
                      </div>
                      <button 
                        onClick={nextOrder}
                        className="bg-[#3E1F00] text-white px-8 py-3 rounded-full font-bold flex items-center gap-2 hover:scale-105 transition-transform"
                      >
                        Siguiente Pedido <ChevronRight size={18} />
                      </button>
                    </motion.div>
                  )}

                  {gameState === 'levelUp' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-[#C0392B] flex flex-col items-center justify-center p-8 text-center text-white"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="mb-6"
                      >
                        <Trophy size={80} />
                      </motion.div>
                      <h3 className="text-4xl font-black mb-2 uppercase italic">¡Ascenso de Nivel!</h3>
                      <p className="text-xl mb-8 opacity-90">Has demostrado ser un gran pizzero. El siguiente nivel será más difícil.</p>
                      <button 
                        onClick={goToNextLevel}
                        className="bg-white text-[#C0392B] px-12 py-4 rounded-full text-xl font-bold shadow-2xl hover:scale-105 transition-transform"
                      >
                        ¡Vamos allá!
                      </button>
                    </motion.div>
                  )}

                  {gameState === 'history' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-white flex flex-col p-6 overflow-hidden"
                    >
                      <div className="flex items-center gap-3 mb-6">
                        <History className="text-[#C0392B]" />
                        <h3 className="text-2xl font-black uppercase italic text-[#C0392B]">Historial de Pedidos</h3>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                        {orderHistory.map((order, i) => (
                          <div key={i} className="bg-[#FFF8E7] p-3 rounded-xl border border-[#3E1F00]/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-2xl">{order.customer.emoji}</span>
                              <div>
                                <p className="text-xs font-bold opacity-50">{order.level}</p>
                                <p className="text-sm font-black">{order.customer.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-[10px] font-mono opacity-70 text-right">
                                <p>R: {order.playerR} / {order.targetR}</p>
                                <p>θ: {order.playerTheta}° / {order.targetTheta}°</p>
                              </div>
                              <div className="flex">
                                {[...Array(order.stars)].map((_, j) => (
                                  <Star key={j} size={10} fill={PALETTE.cheese} color={PALETTE.cheese} />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-4 border-t border-[#3E1F00]/10 text-center">
                        <p className="text-lg font-black mb-4">¡Felicidades! Has completado la historia.</p>
                        <button 
                          onClick={() => setGameState('start')}
                          className="bg-[#C0392B] text-white px-8 py-3 rounded-full font-bold shadow-lg hover:scale-105 transition-transform"
                        >
                          Volver al Menú
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {gameState === 'gameOver' && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="absolute inset-0 bg-[#3E1F00] flex flex-col items-center justify-center p-8 text-center text-white"
                    >
                      <div className="mb-6 bg-white/10 p-6 rounded-full">
                        <AlertCircle size={64} className="text-[#E74C3C]" />
                      </div>
                      <h3 className="text-4xl font-black mb-2 uppercase italic">Fin de la Partida</h3>
                      <p className="text-xl mb-2 opacity-90">Te has quedado sin vidas.</p>
                      
                      <div className="bg-white/5 p-6 rounded-3xl my-6 w-full max-w-xs">
                        <p className="text-xs uppercase font-bold opacity-50 mb-1">Pedidos Exitosos</p>
                        <p className="text-4xl font-black text-[#F0C040]">{infiniteSuccessCount}</p>
                        <div className="h-px bg-white/10 my-4" />
                        <p className="text-xs uppercase font-bold opacity-50 mb-1">Puntuación Total</p>
                        <p className="text-2xl font-black">{score.toLocaleString()}</p>
                      </div>

                      <button 
                        onClick={() => setGameState('start')}
                        className="bg-[#C0392B] text-white px-12 py-4 rounded-full text-xl font-bold shadow-2xl hover:scale-105 transition-transform"
                      >
                        Volver al Menú
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Right Column: Educational Panel */}
            <div className="lg:col-span-3">
              <div className="bg-[#3E1F00] text-white rounded-3xl p-6 shadow-xl sticky top-8">
                <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                  <Calculator size={20} className="text-[#F0C040]" />
                  <h3 className="text-lg font-black uppercase tracking-wider">Panel Educativo</h3>
                </div>

                <div className="space-y-5">
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold opacity-40">
                      <span>Radio (r)</span>
                      {currentOrder && <span className="text-[#F0C040]">Objetivo: {currentOrder.targetR}</span>}
                    </div>
                    <p className={`text-xl font-mono ${currentOrder && playerR === currentOrder.targetR ? 'text-[#F0C040]' : ''}`}>
                      {playerR.toFixed(1)} <span className="text-xs opacity-50">cm</span>
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] uppercase font-bold opacity-40">
                      <span>Ángulo (θ)</span>
                      {currentOrder && <span className="text-[#F0C040]">Objetivo: {currentOrder.targetTheta}°</span>}
                    </div>
                    <p className={`text-xl font-mono ${currentOrder && playerTheta === currentOrder.targetTheta ? 'text-[#F0C040]' : ''}`}>
                      {playerTheta}°
                    </p>
                  </div>

                  <div className="h-px bg-white/10 my-4" />

                  <div className="space-y-3">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Ángulo en Radianes</p>
                      <p className="text-sm font-mono">θ × π/180 = <span className="text-[#F0C040]">{radians.toFixed(4)}</span> rad</p>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Área del Sector</p>
                      <p className="text-sm font-mono">A = (θ/360)πr² = <span className="text-[#F0C040]">{sectorArea.toFixed(2)}</span> cm²</p>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <div className="flex justify-between text-[10px] uppercase font-bold opacity-40 mb-1">
                        <span>Longitud de Arco</span>
                        {currentOrder?.targetArcLength && <span className="text-[#F0C040]">Objetivo: {currentOrder.targetArcLength.toFixed(1)}</span>}
                      </div>
                      <p className="text-sm font-mono">
                        L = (θ/360)2πr
                      </p>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                      <p className="text-[10px] uppercase font-bold opacity-40 mb-1">Área Total</p>
                      <p className="text-sm font-mono">A = πr² = <span className="text-[#F0C040]">{totalArea.toFixed(2)}</span> cm²</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-white/10 flex items-start gap-3">
                  <Info size={16} className="text-[#F0C040] shrink-0 mt-1" />
                  <p className="text-[10px] leading-relaxed opacity-60 italic">
                    Un sector circular es la porción de un círculo delimitada por dos radios y un arco. 
                    ¡La precisión es clave para una pizza perfecta!
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-[#3E1F00]/40 text-xs font-bold uppercase tracking-widest">
          &copy; 2026 Pizzería Geométrica &bull; Trattoria di Matematica &bull; Sat, 14 Mar
        </footer>
      </div>

      {/* Custom Styles for Slider */}
      <style dangerouslySetInnerHTML={{ __html: `
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #C0392B;
          cursor: pointer;
          border: 4px solid white;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
        .drop-shadow-glow {
          filter: drop-shadow(0 0 8px rgba(240, 192, 64, 0.6));
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.05);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #C0392B;
          border-radius: 10px;
        }
      `}} />
    </div>
  );
}
