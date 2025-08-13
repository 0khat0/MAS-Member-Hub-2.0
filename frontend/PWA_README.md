# PWA (Progressive Web App) Setup

This project has been configured as a Progressive Web App (PWA) to provide a native app-like experience for users.

## Features

- **Add to Home Screen**: Users can install the app on their device's home screen
- **Offline Support**: Basic offline functionality with cached resources
- **App-like Experience**: Full-screen mode, standalone display
- **Cross-platform**: Works on Android, iOS, and desktop browsers

## How It Works

### InstallPWA Component
The `InstallPWA` component automatically detects when the app can be installed and shows a prompt to users. It handles:

- **Android/Chrome**: Uses native `beforeinstallprompt` event
- **iOS Safari**: Shows step-by-step instructions since iOS doesn't support the install API
- **Smart Dismissal**: Remembers when users dismiss the prompt and doesn't show it again for 7 days
- **Installation Detection**: Automatically hides after successful installation

### Service Worker
The service worker (`/public/sw.js`) provides:

- **Resource Caching**: Caches essential app files for offline use
- **Offline Fallback**: Shows offline page when network requests fail
- **Cache Management**: Automatically cleans up old cache versions

### PWA Manifest
The manifest file (`/public/manifest.json`) defines:

- App name, description, and icons
- Display mode (standalone for app-like experience)
- Theme colors and orientation
- Start URL and scope

## Usage

The InstallPWA component is automatically included in the ProfilePage and will show the install prompt when appropriate.

### Manual Integration
To add the install prompt to other pages:

```tsx
import InstallPWA from './components/InstallPWA';

function MyPage() {
  return (
    <div>
      {/* Your page content */}
      <InstallPWA appName="MAS Hub" />
    </div>
  );
}
```

### Customization
You can customize the component with props:

```tsx
<InstallPWA 
  appName="Custom App Name"
  dismissDays={14} // Hide for 14 days after dismiss
  className="my-custom-class"
/>
```

## Browser Support

- **Chrome/Edge**: Full PWA support with native install prompt
- **Firefox**: Full PWA support
- **Safari (iOS)**: Limited support (no install API, but can be added to home screen manually)
- **Safari (macOS)**: Limited support

## Testing

1. **Development**: Use Chrome DevTools > Application tab to test PWA features
2. **Installation**: Look for the install button in the address bar or use the InstallPWA component
3. **Offline**: Use DevTools > Network tab to simulate offline mode
4. **Lighthouse**: Run Lighthouse audit to verify PWA score

## Icons

The app uses two icon sizes:
- `icon-192.png`: 192x192 pixels (standard)
- `icon-512.png`: 512x512 pixels (high resolution)

These are automatically used by the PWA manifest and service worker.

## Troubleshooting

- **Install prompt not showing**: Check if the app meets PWA criteria (HTTPS, manifest, service worker)
- **Service worker not registering**: Verify the service worker file exists and is accessible
- **Offline not working**: Check service worker cache configuration and offline.html file
