export async function cameraPermissionReady(
  api,
  permissions = navigator.permissions,
) {
  const { state } = await permissions.query({ name: 'camera' });
  if (state === 'granted') return true;
  await api.tabs.create({ url: api.runtime.getURL('extension/camera.html') });
  return false;
}
