import { useState, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkWikiLink from 'remark-wiki-link'
import rehypeHighlight from 'rehype-highlight'
import rehypeSlug from 'rehype-slug'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function rewriteImageUri(src) {
  if (!src) return src
  // Absolute URLs pass through unchanged
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  // Relative paths get served via the backend images endpoint
  return `${BASE_URL}/api/academy/images/${src.replace(/^\//, '')}`
}

// hrefTemplate must be a function per remark-wiki-link v2 API
const wikiLinkOptions = {
  hrefTemplate: (permalink) => `/academy/${permalink}`,
  aliasDivider: '|',
}

function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef(null)

  const handleCopy = () => {
    const text = preRef.current?.textContent ?? ''
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="relative group/code">
      <pre ref={preRef} {...props}>{children}</pre>
      <button
        onClick={handleCopy}
        aria-label="Copy code"
        className="absolute top-2 right-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium
                   bg-stone-700/80 hover:bg-stone-600 text-stone-200 backdrop-blur-sm
                   opacity-0 group-hover/code:opacity-100 transition-opacity duration-150"
      >
        {copied ? (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <rect x="9" y="9" width="13" height="13" rx="2" strokeLinejoin="round" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  )
}

const markdownComponents = {
  pre: CodeBlock,
}

export default function AcademyMarkdownRenderer({ content }) {
  if (!content) return null

  return (
    <div className="prose prose-stone dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkWikiLink, wikiLinkOptions]]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
        components={markdownComponents}
        urlTransform={(url, key) => {
          if (key === 'src') return rewriteImageUri(url)
          return url
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
