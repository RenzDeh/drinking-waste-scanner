import { ref, onBeforeUnmount } from 'vue'

/**
 * Achtercamera starten in een <video>. Op iOS Safari zijn `playsinline` en `muted`
 * verplicht (die staan op het element in ScanView), anders opent iOS fullscreen of
 * start de video niet automatisch.
 */
export function useCamera() {
  const status = ref('idle') // idle | starting | ready | denied | unavailable | insecure | error
  const errorMessage = ref('')
  let stream = null

  async function start(videoEl) {
    if (!window.isSecureContext) {
      status.value = 'insecure'
      errorMessage.value = 'De camera werkt enkel via HTTPS (of localhost).'
      return false
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      status.value = 'unavailable'
      errorMessage.value = 'Deze browser ondersteunt geen camera-toegang.'
      return false
    }
    status.value = 'starting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      videoEl.srcObject = stream
      videoEl.setAttribute('playsinline', '')
      videoEl.muted = true
      await videoEl.play()
      if (!videoEl.videoWidth) {
        await new Promise((r) => videoEl.addEventListener('loadedmetadata', r, { once: true }))
      }
      status.value = 'ready'
      return true
    } catch (e) {
      stop()
      if (e?.name === 'NotAllowedError' || e?.name === 'SecurityError') {
        status.value = 'denied'
        errorMessage.value = 'Cameratoegang geweigerd.'
      } else if (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError') {
        status.value = 'unavailable'
        errorMessage.value = 'Geen geschikte camera gevonden.'
      } else {
        status.value = 'error'
        errorMessage.value = e?.message || 'Camera kon niet starten.'
      }
      return false
    }
  }

  function stop() {
    stream?.getTracks().forEach((t) => t.stop())
    stream = null
    if (status.value === 'ready' || status.value === 'starting') status.value = 'idle'
  }

  onBeforeUnmount(stop)

  return { status, errorMessage, start, stop }
}
