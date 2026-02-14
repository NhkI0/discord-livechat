interface MediaRegionSettings {
  x: number;
  y: number;
  width: number;
  height: number;
}

document.addEventListener('DOMContentLoaded', async () => {
  const api = (window as any).electronAPI;
  const inputX = document.getElementById('input-x') as HTMLInputElement;
  const inputY = document.getElementById('input-y') as HTMLInputElement;
  const inputW = document.getElementById('input-w') as HTMLInputElement;
  const inputH = document.getElementById('input-h') as HTMLInputElement;
  const status = document.getElementById('status') as HTMLDivElement;

  function populateFields(s: MediaRegionSettings) {
    inputX.value = String(Math.round(s.x));
    inputY.value = String(Math.round(s.y));
    inputW.value = String(Math.round(s.width));
    inputH.value = String(Math.round(s.height));
  }

  function showStatus(message: string) {
    status.textContent = message;
    setTimeout(() => { status.textContent = ''; }, 2000);
  }

  // Load initial values
  const settings = await api.getMediaSettings();
  populateFields(settings);

  // Live update when settings change from edit mode
  api.onMediaSettingsChanged((s: MediaRegionSettings) => populateFields(s));

  document.getElementById('btn-apply')!.addEventListener('click', async () => {
    await api.saveMediaSettings({
      x: parseInt(inputX.value) || 0,
      y: parseInt(inputY.value) || 0,
      width: parseInt(inputW.value) || 1200,
      height: parseInt(inputH.value) || 800,
    });
    showStatus('Settings applied!');
  });

  document.getElementById('btn-edit')!.addEventListener('click', () => {
    api.requestEditMode();
    showStatus('Edit mode activated - drag to reposition on overlay');
  });

  document.getElementById('btn-reset')!.addEventListener('click', async () => {
    await api.resetMediaSettings();
    showStatus('Reset to defaults!');
  });
});
