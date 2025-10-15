import Link from 'next/link';
import { FileQuestion } from 'lucide-react';

export default function DocNotFound() {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FileQuestion className="h-24 w-24 text-muted-foreground mb-4" />
        <h1 className="text-3xl font-bold mb-2">Documentation Not Found</h1>
        <p className="text-muted-foreground mb-6">
          The documentation page you&apos;re looking for doesn&apos;t exist.
        </p>
        <Link
          href="/docs"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Back to Documentation
        </Link>
      </div>
    </div>
  );
}
