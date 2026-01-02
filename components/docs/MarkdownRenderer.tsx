'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Components } from 'react-markdown';
import { isValidElement } from 'react';

interface MarkdownRendererProps {
  content: string;
}

interface CodeProps {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  // Remove the first h1 from content to avoid duplicate headers
  // The title is already displayed above the markdown
  const processedContent = content.replace(/^#\s+.+$/m, '');

  // Match TableOfContents heading ID generation so in-page anchors work.
  const getText = (node: React.ReactNode): string => {
    if (node == null) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(getText).join('');
    // react-markdown nodes are ReactElements; read their children recursively.
    if (isValidElement(node)) {
      const element = node as React.ReactElement<{ children?: React.ReactNode }>;
      return getText(element.props.children);
    }
    return '';
  };

  const toBaseId = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-');

  // NOTE: We intentionally do not de-dupe IDs to avoid hydration mismatches in dev.
  // If you need unique IDs, use a slugger/rehype plugin to generate them consistently.
  const getHeadingId = (children: React.ReactNode) => {
    const text = getText(children).replace(/\*\*/g, '').replace(/\*/g, '').trim();
    const baseId = toBaseId(text);
    return baseId || undefined;
  };

  const components: Components = {
    // IMPORTANT:
    // - react-markdown renders fenced blocks as <pre><code class="language-...">...</code></pre>
    // - If we render our own <pre> inside `code`, we end up with nested <pre> and hydration issues.
    // So: handle block code in `pre`, and keep `code` for inline only.
    code({ className, children, ...props }: CodeProps) {
      return (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
    pre({ children, ...props }) {
      // Expect a single <code> child for fenced blocks.
      const child = Array.isArray(children) ? children[0] : children;
      if (isValidElement(child)) {
        const codeEl = child as React.ReactElement<{ className?: string; children?: React.ReactNode }>;
        const className = codeEl.props.className;
        const match = /language-(\w+)/.exec(className || '');
        const codeString = String(codeEl.props.children ?? '').replace(/\n$/, '');
        if (match?.[1]) {
          return <CodeBlock language={match[1]} value={codeString} />;
        }
        // No language? Still render as a block for consistency.
        return <CodeBlock language="" value={codeString} />;
      }

      return (
        <pre {...props}>
          {children}
        </pre>
      );
    },
    h1: ({ children, id, ...props }) => (
      <h1 id={id ?? getHeadingId(children)} className="text-4xl font-bold mt-8 mb-4" {...props}>
        {children}
      </h1>
    ),
    h2: ({ children, id, ...props }) => (
      <h2
        id={id ?? getHeadingId(children)}
        className="text-3xl font-semibold mt-6 mb-3 pb-2 border-b"
        {...props}
      >
        {children}
      </h2>
    ),
    h3: ({ children, id, ...props }) => (
      <h3 id={id ?? getHeadingId(children)} className="text-2xl font-semibold mt-5 mb-2" {...props}>
        {children}
      </h3>
    ),
    h4: ({ children, id, ...props }) => (
      <h4 id={id ?? getHeadingId(children)} className="text-xl font-semibold mt-4 mb-2" {...props}>
        {children}
      </h4>
    ),
    a: ({ href, children, ...props }) => (
      <a
        href={href}
        className="text-blue-600 dark:text-blue-400 hover:underline"
        target={href?.startsWith('http') ? '_blank' : undefined}
        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
        {...props}
      >
        {children}
      </a>
    ),
    blockquote: ({ children, ...props }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 italic my-4 text-muted-foreground" {...props}>
        {children}
      </blockquote>
    ),
    ul: ({ children, ...props }) => (
      <ul className="list-disc pl-6 my-4 space-y-2" {...props}>
        {children}
      </ul>
    ),
    ol: ({ children, ...props }) => (
      <ol className="list-decimal pl-6 my-4 space-y-2" {...props}>
        {children}
      </ol>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-4">
        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-700">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left font-semibold bg-muted">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 border-t">{children}</td>
    ),
  };

  return (
    <div className="prose prose-slate dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4" suppressHydrationWarning>
      <button
        onClick={handleCopy}
        className="absolute right-2 top-2 p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-white opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy code"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </button>
      {mounted ? (
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          className="rounded-md"
          customStyle={{
            margin: 0,
            padding: '1rem',
            fontSize: '0.875rem',
          }}
        >
          {value}
        </SyntaxHighlighter>
      ) : (
        <pre
          className="rounded-md bg-[#282c34] text-[#abb2bf] overflow-x-auto p-4 text-sm"
          tabIndex={0}
          suppressHydrationWarning
        >
          <code className={language ? `language-${language}` : undefined}>{value}</code>
        </pre>
      )}
    </div>
  );
}
