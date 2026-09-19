# GetGRC Windows Agent

Windows desktop security agent for GetGRC.

## Setup

```powershell
npm install
npm run dev
```

## Build installer

```powershell
npm run build:win
```

Output: `dist-release/GetGRC Setup 1.0.0.exe`

> Optional: if you bundle the React client UI, place a built `client/dist` next to this project (see `package.json` → `extraResources`), or leave it empty for tray-only agent.

## Activation

1. Install and run GetGRC  
2. Enter registration key  
3. Agent runs in tray and scans every 24 hours  

## API

- `POST /api/scan/verify`
- `POST /api/scan/upload`

Default server: `https://getgrc.in`
