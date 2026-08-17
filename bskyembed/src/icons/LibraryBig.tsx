import {h} from 'preact'

/**
 * Lucide LibraryBig icon (lucide-static 1.31.0), licensed under ISC.
 * See NOTICE.md and licenses/LUCIDE-ISC.txt in the repository root.
 */
export const LibraryBig = ({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) => (
  <svg
    aria-hidden="true"
    className={className}
    width={size}
    height={size}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    viewBox="0 0 24 24">
    <rect width="8" height="18" x="3" y="3" rx="1" />
    <path d="M7 3v18" />
    <path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" />
  </svg>
)
