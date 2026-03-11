import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';

const STEPS = [
  'Connecting to backend…',
  'Loading AI agents…',
  'Syncing your data…',
  'Preparing workspace…',
];

export default function LoadingScreen() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setStep(s => (s + 1 < STEPS.length ? s + 1 : s));
    }, 600);
    return () => clearInterval(t);
  }, []);

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: 'var(--s0)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      position: 'fixed', inset: 0, zIndex: 99999,
    }}>
      {/* Background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 600px 400px at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          style={{
            width: 64, height: 64, borderRadius: 20, marginBottom: 24,
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(99,102,241,0.4), 0 0 80px rgba(99,102,241,0.15)',
          }}
        >
          <Zap size={32} color="#fff" fill="#fff" />
        </motion.div>

        {/* App name */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-1)', letterSpacing: '-0.02em', marginBottom: 6 }}
        >
          Fabric AI
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          style={{ fontSize: 14, color: 'var(--text-3)', marginBottom: 40 }}
        >
          Your Personal AI Operating System
        </motion.p>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, width: 0 }}
          animate={{ opacity: 1, width: 240 }}
          transition={{ delay: 0.5 }}
          style={{ height: 3, background: 'var(--s4)', borderRadius: 99, overflow: 'hidden', marginBottom: 16 }}
        >
          <motion.div
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #a855f7)', borderRadius: 99 }}
          />
        </motion.div>

        {/* Status text */}
        <AnimatePresence mode="wait">
          <motion.p
            key={step}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}
          >
            {STEPS[step]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
