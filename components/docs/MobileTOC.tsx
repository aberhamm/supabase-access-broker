'use client';

import { useEffect, useState, useRef } from 'react';
import { List, X } from 'lucide-react';

interface TOCItem {
  id: string;
  text: string;
  level: number;
}

interface MobileTOCProps {
  content: string;
}

export function MobileTOC({ content }: MobileTOCProps) {
  const [toc, setToc] = useState<TOCItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const navRef = useRef<HTMLElement>(null);
  const activeItemRef = useRef<HTMLButtonElement>(null);

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
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');

      if (level <= 3) {
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

    const headings = document.querySelectorAll('h1, h2, h3, h4');
    headings.forEach((heading) => observer.observe(heading));

    return () => observer.disconnect();
  }, [toc]);

  // Close on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Scroll active item into view when drawer is open and active changes
  useEffect(() => {
    if (isOpen && activeId && activeItemRef.current && navRef.current) {
      const nav = navRef.current;
      const activeItem = activeItemRef.current;

      const navRect = nav.getBoundingClientRect();
      const itemRect = activeItem.getBoundingClientRect();

      const isAbove = itemRect.top < navRect.top;
      const isBelow = itemRect.bottom > navRect.bottom;

      if (isAbove || isBelow) {
        activeItem.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      }
    }
  }, [activeId, isOpen]);

  const handleClick = (id: string) => {
    setIsOpen(false);
    // Small delay to allow drawer to close before scrolling
    setTimeout(() => {
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  if (toc.length === 0) return null;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen(true)}
        className="mobile-toc-trigger"
        aria-label="Open table of contents"
      >
        <List className="h-4 w-4" />
        <span>Contents</span>
      </button>

      {/* Drawer overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 w-[300px] max-w-[85vw] bg-card border-l shadow-xl z-50 transform transition-transform duration-300 ease-out lg:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold">On This Page</h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close table of contents"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav ref={navRef} className="p-4 overflow-y-auto max-h-[calc(100vh-60px)]">
          <ul className="space-y-2">
            {toc.map((item) => {
              const isActive = activeId === item.id;
              return (
                <li
                  key={item.id}
                  style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}
                >
                  <button
                    ref={isActive ? activeItemRef : null}
                    onClick={() => handleClick(item.id)}
                    className={`w-full text-left py-1.5 px-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    {item.text}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
