import { Capacitor } from '@capacitor/core'

/**
 * Hands a text file to the user: a download on the web, the share sheet on Android
 * (the WebView ignores <a download>, so the file is written to the cache and shared).
 */
export async function saveTextFile(name: string, text: string, mime: string) {
  if (Capacitor.isNativePlatform()) {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    await Share.share({ title: name, files: [uri] })
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

/** Asks the browser not to evict IndexedDB under storage pressure (games live only here without sync). */
export function requestPersistentStorage() {
  void navigator.storage?.persist?.().catch(() => false)
}
