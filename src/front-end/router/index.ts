import { createRouter, createWebHashHistory } from 'vue-router';

import Index from '../views/Index.vue';
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
    }
];


const router = createRouter({
    history: createWebHashHistory(),
    routes,
});

export default router;