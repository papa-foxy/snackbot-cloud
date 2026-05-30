// src/types/global.d.ts
export {};

declare global {
  interface Window {
    __appNavigate?: (page: string, params?: Record<string, any>) => void;
    __appNavigateParams?: Record<string, any>;
  }
}