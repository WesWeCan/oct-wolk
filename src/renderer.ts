import './front-end/styles/index.scss';

import { createApp } from 'vue';
import App from './front-end/App.vue';
import router from './front-end/router';

const app = createApp(App).use(router);

app.mount('#app');
