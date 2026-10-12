import { openStorageFile } from '../lib/storageFiles'

export default function SecureFileLink({ bucket, value, className, children }) {
  return (
    <a
      href="#"
      onClick={(event) => {
        event.preventDefault()
        openStorageFile(bucket, value)
      }}
      className={className}
    >
      {children}
    </a>
  )
}
