import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Home, ExternalLink } from 'lucide-react';
import { getDocContent, getAllDocs } from '@/lib/docs';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { CopyDocButton } from '@/components/docs/CopyDocButton';
import { TableOfContents } from '@/components/docs/TableOfContents';
import { Badge } from '@/components/ui/badge';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface DocPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const docs = await getAllDocs();
  return docs.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const result = await getDocContent(slug);

  if (!result) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: `${result.metadata.title} | Documentation`,
    description: result.metadata.description,
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const result = await getDocContent(slug);

  if (!result) {
    notFound();
  }

  const { content, metadata } = result;

  // Get related docs from same category
  const allDocs = await getAllDocs();
  const relatedDocs = allDocs
    .filter((d) => d.category === metadata.category && d.slug !== slug)
    .slice(0, 3);

  // Category labels
  const categoryLabels = {
    dashboard: 'Dashboard Setup',
    integration: 'App Integration',
    core: 'Core Concepts',
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Breadcrumb */}
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/">
              <Home className="h-4 w-4" />
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href="/docs">Documentation</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{metadata.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
        {/* Main content */}
        <div className="min-w-0">
          {/* Header */}
          <div className="mb-8">
            <div className="flex gap-2 mb-3">
              <Badge variant="outline">{categoryLabels[metadata.category]}</Badge>
              <Badge variant="secondary">{metadata.audience}</Badge>
            </div>

            <h1 className="text-4xl font-bold mb-2">{metadata.title}</h1>
            <p className="text-lg text-muted-foreground mb-4">{metadata.description}</p>

            <div className="flex flex-wrap gap-2">
              <CopyDocButton content={content} />

              <Link
                href={`https://github.com/supabase-community/supabase-custom-claims/blob/main/admin-dashboard/content/docs/${metadata.filePath}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md hover:bg-accent"
              >
                <ExternalLink className="h-4 w-4" />
                View on GitHub
              </Link>
            </div>
          </div>

          {/* Markdown content */}
          <div className="doc-content">
            <MarkdownRenderer content={content} />
          </div>

          {/* Related docs */}
          {relatedDocs.length > 0 && (
            <div className="mt-12 pt-8 border-t">
              <h3 className="text-xl font-semibold mb-4">
                Related {categoryLabels[metadata.category]} Documentation
              </h3>
              <div className="grid gap-4 md:grid-cols-3">
                {relatedDocs.map((relatedDoc) => (
                  <Link
                    key={relatedDoc.slug}
                    href={`/docs/${relatedDoc.slug}`}
                    className="p-4 border rounded-lg hover:shadow-md transition-shadow"
                  >
                    <h4 className="font-semibold mb-1">{relatedDoc.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {relatedDoc.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Table of contents sidebar */}
        <aside className="hidden lg:block">
          <TableOfContents content={content} />
        </aside>
      </div>
    </div>
  );
}
