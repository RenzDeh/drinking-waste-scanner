// Korte trilling bij een geldige scan.
// - Android/Chrome: navigator.vibrate()
// - iOS Safari ondersteunt navigator.vibrate NIET. Vanaf iOS 18 geeft het togglen van een
//   <input type="checkbox" switch> wel een korte haptische tik; die gebruiken we als fallback.
let iosSwitch = null

function getIosSwitch() {
  if (iosSwitch) return iosSwitch
  const label = document.createElement('label')
  label.setAttribute('aria-hidden', 'true')
  label.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.setAttribute('switch', '')
  input.tabIndex = -1
  label.appendChild(input)
  document.body.appendChild(label)
  iosSwitch = label
  return label
}

export function buzz(pattern = [40, 30, 60]) {
  try {
    if (typeof navigator.vibrate === 'function' && navigator.vibrate(pattern)) return
  } catch {
    /* negeren */
  }
  try {
    getIosSwitch().click()
  } catch {
    /* geen haptiek beschikbaar */
  }
}
