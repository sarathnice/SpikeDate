import { Capacitor } from '@capacitor/core';

let initialized = false;

function navigateDeepLink(url: string) {
  const parsed = new URL(url);
  const route =
    parsed.protocol === 'spikedate:'
      ? '/' +
        [parsed.hostname, parsed.pathname.replace(/^\//, '')]
          .filter(Boolean)
          .join('/')
      : parsed.pathname + parsed.search;
  if (route.startsWith('/profile/') || route.startsWith('/chat/'))
    window.location.assign('/?' + route.slice(1).replace('/', '='));
}

export async function initializeMobileRuntime() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  initialized = true;
  const [{ App }, { Network }, { PushNotifications }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/network'),
    import('@capacitor/push-notifications'),
  ]);

  await App.addListener('appUrlOpen', ({ url }) => navigateDeepLink(url));
  await Network.addListener('networkStatusChange', ({ connected }) => {
    window.dispatchEvent(
      new CustomEvent('spikedate:network', { detail: { connected } }),
    );
  });

  const permission = await PushNotifications.checkPermissions();
  const status =
    permission.receive === 'prompt'
      ? await PushNotifications.requestPermissions()
      : permission;
  if (status.receive !== 'granted') return;
  await PushNotifications.addListener('registration', async ({ value }) => {
    await fetch('/api/devices', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        platform: Capacitor.getPlatform(),
        token: value,
      }),
    });
  });
  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    ({ notification }) => {
      const url = notification.data?.url;
      if (typeof url === 'string') navigateDeepLink(url);
    },
  );
  await PushNotifications.register();
}
