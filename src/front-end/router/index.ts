import { createRouter, createWebHashHistory } from 'vue-router';

import Index from '../views/Index.vue';
import Player from '../views/Player.vue';
import ProjectEditor from '../views/ProjectEditor.vue';

const routes = [
    { 
        path: '/', 
        name: 'Index',
        component: Index,
    },
    {
        path: '/project/:projectId',
        name: 'ProjectEditor',
        component: ProjectEditor,
        props: true,
    },
    {
        path: '/player',
        name: 'Player',
        component: Player,
    }
];


const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;