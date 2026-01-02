'use client';

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface TableOfContentsProps {
  content: string;
}

export function TableOfContents({ content }: TableOfContentsProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Match MarkdownRenderer behavior: the first H1 is displayed separately by the page header.
    const processedContent = content.replace(/^#\s+.+$/m, '');

    // Extract headings from markdown
    const headingRegex = /^(#{1,4})\s+(.+)$/gm;
    const items: TOCItem[] = [];
    let match;

    while ((match = headingRegex.exec(processedContent)) !== null) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, '').replace(/\*/g, '');
      // Create ID from text
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      if (level <= 3) { // Only show h1, h2, h3
        items.push({ id, text, level });
      }
    }

    setToc(items);
  }, [content]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      { rootMargin: '-100px 0px -80% 0px' }
    );

    // Observe all headings
    const headings = document.querySelectorAll('h1, h2, h3, h4');
    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [toc]);

  if (toc.length === 0) return null;

  return (
    <nav className="sticky top-20 hidden lg:block">
      <h4 className="font-semibold text-sm mb-2">On This Page</h4>
      <ul className="space-y-2 text-sm">
        {toc.map((item) => (
          <li
            key={item.id}
            style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}
          >
            <a
              href={`#${item.id}`}
              className={`flex items-start gap-1 hover:text-primary transition-colors ${
                activeId === item.id
                  ? 'text-primary font-medium'
                  : 'text-muted-foreground'
              }`}
            >
              {activeId === item.id && (
                <ChevronRight className="h-4 w-4 flex-shrink-0 mt-0.5" />
              )}
              <span className={activeId !== item.id ? 'ml-5' : ''}>
                {item.text}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
