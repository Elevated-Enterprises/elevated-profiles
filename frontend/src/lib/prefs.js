export function getPreference(key, defaultValue = null) {
  const stored = localStorage.getItem(key)
  return stored !== null ? stored : defaultValue
}

export function setPreference(key, value) {
  localStorage.setItem(key, String(value))
}
