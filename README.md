# RuvoPlayer Backup API

This is the backup API deployment for RuvoPlayer, providing redundancy and failover capabilities.

## 🚀 **Purpose**

- **Primary API**: `https://ruvoplayer-api.vercel.app`
- **Backup API**: This repository (deployed to Vercel)
- **Failover Strategy**: Automatic fallback if primary API is unavailable

## 📁 **API Endpoints**

- **`/parse`** - Parse M3U playlists
- **`/xtream`** - Xtream Codes API integration
- **`/stalker`** - Stalker Portal integration
- **`/health`** - Health check endpoint

## 🛠️ **Deployment**

### **Vercel Deployment**
1. Connect this repository to Vercel
2. Deploy to get your backup API URL
3. Update your app's environment files with the backup URL

### **Environment Configuration**
```typescript
// environment.web.ts
export const AppConfig = {
    BACKEND_URL: 'https://ruvoplayer-api.vercel.app',
    FALLBACK_APIS: [
        'https://ruvoplayer-api.vercel.app',        // Primary
        'https://your-backup-api.vercel.app'        // Backup (this repo)
    ]
};
```

## 🔄 **Sync with Main API**

To keep this backup API in sync with your main API:

1. **Copy updates** from main API repository
2. **Deploy changes** to Vercel
3. **Test endpoints** to ensure functionality

## 📊 **Health Monitoring**

Monitor both APIs to ensure availability:
- Primary: `https://ruvoplayer-api.vercel.app/health`
- Backup: `https://your-backup-api.vercel.app/health`

## 🎯 **Usage**

The backup API automatically activates when:
- Primary API returns errors
- Primary API times out
- Primary API is unreachable

Users experience seamless failover with no manual intervention required.
