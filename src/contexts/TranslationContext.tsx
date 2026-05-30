import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { GoogleGenAI } from '@google/genai';

interface TranslationContextType {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string, defaultText: string) => string;
  isTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState('en');
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [isTranslating, setIsTranslating] = useState(false);

  // Use a ref to collect texts without triggering re-renders
  const pendingTextsRef = useRef<Record<string, string>>({});
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const translateBatch = async () => {
    const textsToTranslate = { ...pendingTextsRef.current };
    
    // Filter out texts that are already translated
    const newTexts: Record<string, string> = {};
    for (const key in textsToTranslate) {
      if (!translations[key]) {
        newTexts[key] = textsToTranslate[key];
      }
    }

    if (Object.keys(newTexts).length === 0) return;
    
    setIsTranslating(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Translate the following JSON object values to ${language}. Keep the keys exactly the same. Return ONLY valid JSON.\n\n${JSON.stringify(newTexts)}`,
        config: {
          responseMimeType: "application/json",
        }
      });
      
      const translatedData = JSON.parse(response.text || '{}');
      setTranslations(prev => ({ ...prev, ...translatedData }));
      
      // Clear pending texts that were successfully translated
      for (const key in translatedData) {
        delete pendingTextsRef.current[key];
      }
    } catch (error) {
      console.error('Translation error:', error);
    } finally {
      setIsTranslating(false);
    }
  };

  useEffect(() => {
    if (language === 'en') {
      setTranslations({});
      pendingTextsRef.current = {};
      return;
    }

    // When language changes, we need to re-translate everything we know about
    const allKnownKeys = Object.keys(translations);
    if (allKnownKeys.length > 0) {
      // Move all known keys back to pending
      const newPending: Record<string, string> = {};
      // We don't have the original english text easily available here, 
      // but the render cycle will re-register them with the defaultText.
      setTranslations({});
      pendingTextsRef.current = {};
    }
  }, [language]);

  const t = (key: string, defaultText: string) => {
    if (language === 'en') return defaultText;
    
    if (translations[key]) {
      return translations[key];
    }
    
    if (!pendingTextsRef.current[key]) {
      pendingTextsRef.current[key] = defaultText;
      
      // Schedule translation
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(translateBatch, 500);
    }
    
    return defaultText; // Return default while translating
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t, isTranslating }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}
