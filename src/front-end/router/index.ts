import { createRouter, createWebHashHistory } from 'vue-router';

import Index from '../views/Index.vue';
import SongBank from '../views/SongBank.vue';
import LyricAnalyzer from '../views/LyricAnalyzer.vue';
import Editor from '../views/Editor.vue';
import Player from '../views/Player.vue';

const routes = [
    { 
        path: '/', 
        name: 'Index',
        component: Index,
    },
    {
        path: '/song-bank',
        name: 'SongBank',
        component: SongBank,
    },
    {
        path: '/lyric-analyzer/:songId?',
        name: 'LyricAnalyzer',
        component: LyricAnalyzer,
    },
    {
        path: '/editor',
        name: 'Editor',
        component: Editor,
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