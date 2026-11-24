// Veilige wrapper rond localStorage. In private mode, bij geblokkeerde site-data of
// volle opslag kan localStorage een fout gooien; dan vallen we terug op geheugen.
const memory = new Map()

export function getItem(key) {
  try {
    const value = window.localStorage.getItem(key)
    return value ?? memory.get(key) ?? null
  } catch {
    return memory.get(key) ?? null
  }
}

export function setItem(key, value) {
  memory.set(key, value)
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function removeItem(key) {
  memory.delete(key)
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* negeren */
  }
}

export function getJSON(key, fallback) {
  const raw = getItem(key)
  if (raw == null) return fallback
  try {
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

export function setJSON(key, value) {
  return setItem(key, JSON.stringify(value))
}
