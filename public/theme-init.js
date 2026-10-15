// Aplica el tema elegido antes de que se dibuje la interfaz, para que no aparezca un instante
// con el tema del sistema. Las preferencias las guarda PreferencesService (src/app/core).
try {
  const prefs = JSON.parse(localStorage.getItem('fonetica-rp:preferencias') || '{}');
  if (prefs.theme === 'light' || prefs.theme === 'dark') {
    document.documentElement.dataset.theme = prefs.theme;
  }
} catch {
  // Sin almacenamiento se usa el tema del sistema.
}
