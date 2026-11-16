import { Capacitor } from '@capacitor/core'

/** Opens the Android share sheet; closing it without choosing rejects, which is not an error. */
async function shareUri(name: string, uri: string) {
  const { Share } = await import('@capacitor/share')
  try {
    await Share.share({ title: name, files: [uri] })
  } catch (e) {
    if (!/cancel/i.test(String((e as Error)?.message ?? e))) throw e
  }
}

/**
 * Hands a text file to the user: a download on the web, the share sheet on Android
 * (the WebView ignores <a download>, so the file is written to the cache and shared).
 */
export async function saveTextFile(name: string, text: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await shareUri(name, uri)
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: mime }))
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  // revoking right away can cancel the download in some browsers
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}

/** Same as saveTextFile for binary files (videos): a download on the web, the share sheet on Android. */
export async function saveBlobFile(name: string, blob: Blob) {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    // the plugin takes binary data as base64
    const data = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result).split(',')[1] ?? '')
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
    const { uri } = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache })
    await shareUri(name, uri)
    return
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.append(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 30_000)
}

/** Asks the browser not to evict IndexedDB under storage pressure (games live only here without sync). */
export function requestPersistentStorage() {
  void navigator.storage?.persist?.().catch(() => false)
}
