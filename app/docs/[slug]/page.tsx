import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import { getDocContent, docsMetadata, getAllDocSlugs } from '@/lib/docs';
import { MarkdownRenderer } from '@/components/docs/MarkdownRenderer';
import { CopyDocButton } from '@/components/docs/CopyDocButton';
import { TableOfContents } from '@/components/docs/TableOfContents';

interface DocPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: DocPageProps): Promise<Metadata> {
  const { slug } = await params;
  const doc = docsMetadata[slug];

  if (!doc) {
    return {
      title: 'Not Found',
    };
  }

  return {
    title: `${doc.title} | Documentation`,
    description: doc.description,
  };
}

export default async function DocPage({ params }: DocPageProps) {
  const { slug } = await params;
  const content = await getDocContent(slug);
  const doc = docsMetadata[slug];

  if (!content || !doc) {
    notFound();
  }

  // Get related docs
  const allSlugs = getAllDocSlugs();
  const relatedDocs = allSlugs
    .filter((s) => s !== slug)
    .slice(0, 3)
    .map((s) => docsMetadata[s]);

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Back button */}
      <Link
        href="/docs"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Documentation
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_250px] gap-8">
        {/* Main content */}
        <div className="min-w-0">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2">{doc.title}</h1>
            <p className="text-lg text-muted-foreground mb-4">{doc.description}</p>

            <div className="flex flex-wrap gap-2">
              <CopyDocButton content={content} />

              <Link
                href={`https://github.com/supabase-community/supabase-custom-claims/blob/main/admin-dashboard/${doc.fileName}`}
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
          <div className="mt-12 pt-8 border-t">
            <h3 className="text-xl font-semibold mb-4">Related Documentation</h3>
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
        </div>

        {/* Table of contents sidebar */}
        <aside className="hidden lg:block">
          <TableOfContents content={content} />
        </aside>
      </div>
    </div>
  );
}
