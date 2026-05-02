// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://staxre.com',
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [react(), sitemap({
    filter: (page) => !page.includes('/404'),
    serialize: (item) => {
      // Listing detail pages get higher priority + weekly updates
      if (item.url.includes('/deals/') || item.url.includes('/off-market/')) {
        item.changefreq = 'weekly';
        item.priority = 0.8;
      }
      return item;
    },
  })]
});
