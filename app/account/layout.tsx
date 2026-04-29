import { StepUpProvider } from '@/components/auth/StepUpProvider';

export default function AccountLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Account-self-service routes (unenroll MFA, change password, etc.) trigger
  // step-up gates server-side. Wrapping with the provider lets those flows
  // open the inline MFA challenge modal instead of erroring out.
  return <StepUpProvider>{children}</StepUpProvider>;
}
