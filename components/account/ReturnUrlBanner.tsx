import { ExternalLink } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ReturnUrlBannerProps {
  url: string;
  appName: string;
}

export function ReturnUrlBanner({ url, appName }: ReturnUrlBannerProps) {
  return (
    <Alert>
      <ExternalLink className="h-4 w-4" />
      <AlertTitle>You were sent here from {appName}</AlertTitle>
      <AlertDescription className="flex items-center gap-3">
        <span>When you&apos;re done, head back to your app.</span>
        <Button variant="outline" size="sm" asChild>
          <a href={url}>Return to {appName}</a>
        </Button>
      </AlertDescription>
    </Alert>
  );
}
