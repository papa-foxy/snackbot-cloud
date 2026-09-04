import React from 'react';
import { AmbientCanvas } from './AmbientCanvas';

interface AuthLayoutProps {
  children: React.ReactNode;
  maxWidth?: string;
}

export function AuthLayout({ children, maxWidth = 'max-w-lg' }: AuthLayoutProps) {
  return (
    <AmbientCanvas>
      <div className={`relative z-10 w-full ${maxWidth}`}>
        {children}
      </div>
    </AmbientCanvas>
  );
}
