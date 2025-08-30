import { createContext, useContext, useState, ReactNode } from 'react';

interface OAuthContextType {
  onOAuthConnect: ((accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) | null;
  setOAuthConnectHandler: (handler: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) => void;
}

const OAuthContext = createContext<OAuthContextType | undefined>(undefined);

export function OAuthProvider({ children }: { children: ReactNode }) {
  const [onOAuthConnect, setOnOAuthConnect] = useState<((accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) | null>(null);

  const setOAuthConnectHandler = (handler: (accessToken: string, refreshToken: string, companyId: string, userEmail: string) => void) => {
    setOnOAuthConnect(() => handler);
  };

  return (
    <OAuthContext.Provider value={{ onOAuthConnect, setOAuthConnectHandler }}>
      {children}
    </OAuthContext.Provider>
  );
}

export function useOAuth() {
  const context = useContext(OAuthContext);
  if (context === undefined) {
    throw new Error('useOAuth must be used within an OAuthProvider');
  }
  return context;
}