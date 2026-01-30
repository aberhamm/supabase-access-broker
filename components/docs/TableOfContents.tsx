'use client';

import { useEffect, useState, useRef } from 'react';

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
  const navRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLAnchorElement>(null);

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

  // Scroll active item into view when it changes
  useEffect(() => {
    if (activeId && activeItemRef.current && navRef.current) {
      const nav = navRef.current;
      const activeItem = activeItemRef.current;

      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      // Check if item is outside the visible area of the nav
      const isAbove = itemRect.top < navRect.top;
      const isBelow = itemRect.bottom > navRect.bottom;

      if (isAbove || isBelow) {
        activeItem.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeId]);

  if (toc.length === 0) return null;

  return (
    <nav ref={navRef} className="docs-toc" aria-label="Table of contents">
      <h4 className="text-sm font-semibold mb-4 text-foreground">On This Page</h4>
      <ul className="space-y-1">
        {toc.map((item) => {
          const isActive = activeId === item.id;
          return (
            <li
              key={item.id}
              className="docs-toc-item"
              style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}
            >
              <a
                ref={isActive ? activeItemRef : null}
                href={`#${item.id}`}
                className={`block py-1 text-sm transition-colors leading-snug ${
                  isActive
                    ? 'docs-toc-item--active text-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
