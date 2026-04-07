import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export function BottomSheet({ isOpen, onClose, title, children }) {
  // Prevent body scrolling when sheet is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-[60] max-w-md mx-auto"
            onClick={onClose}
          />
          
          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] flex flex-col max-w-md mx-auto shadow-2xl"
          >
            {/* Handle/Grabber */}
            <div className="flex justify-center pt-3 pb-2 w-full" onClick={onClose}>
              <div className="w-12 h-1.5 bg-gray-200 rounded-full"></div>
            </div>

            {/* Header */}
            <div className="px-6 pb-4 flex items-center justify-between border-b border-gray-100 shrink-0">
              <h2 className="text-xl font-bold text-gray-900">{title}</h2>
              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content Body - Scrollable */}
            <div className="p-6 overflow-y-auto pb-safe flex-1">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
