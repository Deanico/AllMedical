import { supabase } from './supabaseClient'

const SIGNED_URL_SECONDS = 120

// Stored values may be a legacy public URL or a plain object path.
const getObjectPath = (bucket, storedValue) => {
  const value = String(storedValue || '')
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`
  ]

  for (const marker of markers) {
    const index = value.indexOf(marker)
    if (index !== -1) {
      return decodeURIComponent(value.slice(index + marker.length).split('?')[0])
    }
  }

  return value
}

export const getSignedFileUrl = async (bucket, storedValue) => {
  if (!supabase) throw new Error('Storage is not configured.')

  const { data, error } = await supabase
    .storage
    .from(bucket)
    .createSignedUrl(getObjectPath(bucket, storedValue), SIGNED_URL_SECONDS)

  if (error) throw error
  return data.signedUrl
}

// Opens the tab immediately so popup blockers allow it, then points it at a short-lived signed URL.
export const openStorageFile = async (bucket, storedValue) => {
  const newWindow = window.open('', '_blank')

  try {
    const signedUrl = await getSignedFileUrl(bucket, storedValue)
    if (newWindow) {
      newWindow.location.href = signedUrl
    } else {
      window.location.href = signedUrl
    }
  } catch (error) {
    newWindow?.close()
    alert(error.message || 'Unable to open this file.')
  }
}
