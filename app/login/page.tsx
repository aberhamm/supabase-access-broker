import LoginForm from './LoginForm';
import { getLoginBranding } from '@/lib/login-branding-service';

export const dynamic = 'force-dynamic';

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const branding = await getLoginBranding(await searchParams);
  return <LoginForm branding={branding} />;
}
