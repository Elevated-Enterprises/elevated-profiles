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

export default function AcademyMarkdownRenderer({ content }) {
  if (!content) return null

  return (
    <div className="prose prose-stone dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkWikiLink, wikiLinkOptions]]}
        rehypePlugins={[rehypeHighlight, rehypeSlug]}
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
