export interface LoggedInUser {
  id: string;
  email: string;
  name: string;
  role: 'Manager' | 'Supervisor' | 'cashier' | 'kitchen' | 'waiter' | 'platform_admin';
  avatar_url?: string | null;
  is_platform_admin?: boolean;
  merchant_id?: string | null;
}

export interface LoginProps {
  onLogin: (user: LoggedInUser) => void;
}

export type AuthView = 'signin' | 'forgot' | 'reset_sent' | 'link_error';

export interface CarouselSlide {
  img: string;
  alt: string;
  tag: string;
  head: string;
  body: string;
}

export interface HashError {
  errorCode: string;
  description: string;
}
