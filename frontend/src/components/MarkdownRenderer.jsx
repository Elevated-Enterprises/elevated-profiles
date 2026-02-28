import ReactMarkdown from 'react-markdown'

export default function MarkdownRenderer({ content }) {
  if (!content) return null
  return (
    <div className="prose prose-stone prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
