import { createApp } from 'vue'
import { createPinia } from 'pinia';

import './style.css'
import App from './App.vue'

const app = createApp(App);
// Load Adobe Fonts dynamically from .env
const adobeFontKey = import.meta.env.VITE_ADOBE_FONT_KEY;
if (adobeFontKey) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://use.typekit.net/${adobeFontKey}.css`;
    document.head.appendChild(link);
}
app.use(createPinia());
app.mount('#app');
