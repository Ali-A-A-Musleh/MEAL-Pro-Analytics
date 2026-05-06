# MEAL Pro Analytics Studio

This project is a production-ready React + Vite rebuild of the original `MEAL Pro Analytics Studio` single-file app.

## What is included

- Vite + React application structure
- Tailwind CSS with local styles
- Offline-capable bundle with local dependencies
- Excel parsing via `xlsx`
- Charting via `chart.js` and `react-chartjs-2`
- Icons using `lucide-react`
- Motion animations via `framer-motion`
- RTL support and bundled font via `@fontsource/inter`

## Install

Run the following command from the project root:

```bash
npm install
```

## Development

Start a local development server:

```bash
npm run dev
```

Open the URL shown in the terminal to verify the UI.

## Production build

Build the app for production:

```bash
npm run build
```

The compiled app will be written into the `dist` folder.

## Preview the production build

To preview the production output locally:

```bash
npm run preview
```

## Deployment

This is a Single Page Application (SPA) that can be deployed to any static hosting service.

### Files to Upload
After running `npm run build`, copy the entire `dist` folder contents to your web server's public directory.

**Required files:**
- `index.html`
- `assets/` folder

**Optional configuration files** (copy to `dist` if your host requires them):
- `.htaccess` (for Apache servers)
- `_redirects` (for Netlify)
- `vercel.json` (for Vercel)

### Server Configuration

#### Apache (with .htaccess)
The included `.htaccess` file handles SPA routing by redirecting all requests to `index.html`.

#### Nginx
Add this to your nginx config:
```
location / {
    try_files $uri $uri/ /index.html;
}
```

#### Netlify
Upload the `dist` folder contents. The `_redirects` file handles routing.

#### Vercel
Upload the `dist` folder contents. The `vercel.json` file handles routing.

#### Other Static Hosts
Most static hosting services work out of the box with SPAs.

### Testing Deployment
After uploading:
- Verify the app loads correctly
- Test all features work as expected
- Check that navigation doesn't break (if any routing is used)

## Deployment

Deploy the generated `dist` folder to any static web server.

> Note: this app bundles all libraries locally, so it will run offline once the build artifacts are available.
