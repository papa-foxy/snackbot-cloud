import React, { createContext, useContext, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ImpersonationState {
  isImpersonating: boolean;
  merchantId: string | null;
  merchantName: string | null;
  sessionId: string | null;
  isWriteAccess: boolean;
}

interface ImpersonationContextValue extends ImpersonationState {
  startImpersonation: (merchantId: string, merchantName: string, writeAccess?: boolean) => Promise<void>;
  endImpersonation: () => Promise<void>;
}

const ImpersonationContext = createContext<ImpersonationContextValue | null>(null);

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ImpersonationState>({
    isImpersonating: false,
    merchantId:      null,
    merchantName:    null,
    sessionId:       null,
    isWriteAccess:   false,
  });

  const startImpersonation = useCallback(async (
    merchantId: string,
    merchantName: string,
    writeAccess = false
  ) => {
    console.log('[ImpersonationContext] startImpersonation called', { merchantId, merchantName, writeAccess });
    const { data, error } = await supabase.rpc('start_impersonation', {
      p_merchant_id:  merchantId,
      p_write_access: writeAccess,
    });
    if (error) throw new Error(error.message);

    await supabase.rpc('set_config', {
      setting: 'app.current_merchant_id',
      value: merchantId
    });

    setState({
      isImpersonating: true,
      merchantId,
      merchantName,
      sessionId:     data as string,
      isWriteAccess: writeAccess,
    });
  }, []);

  const endImpersonation = useCallback(async () => {
    if (state.sessionId) {
      await supabase.rpc('end_impersonation', { p_session_id: state.sessionId });
    }
    await supabase.rpc('set_config', {
      setting: 'app.current_merchant_id',
      value: ''
    });
    setState({
      isImpersonating: false,
      merchantId:      null,
      merchantName:    null,
      sessionId:       null,
      isWriteAccess:   false,
    });
  }, [state.sessionId]);

  return (
    <ImpersonationContext.Provider value={{ ...state, startImpersonation, endImpersonation }}>
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used inside ImpersonationProvider');
  return ctx;
}