import { createRouter, createWebHashHistory } from 'vue-router';

import Index from '../views/Index.vue';
import SongBank from '../views/SongBank.vue';
import LyricAnalyzer from '../views/LyricAnalyzer.vue';
import Editor from '../views/Editor.vue';
import EditorIndex from '../views/EditorIndex.vue';
import Player from '../views/Player.vue';
import ProjectList from '../views/ProjectList.vue';
import ProjectEditor from '../views/ProjectEditor.vue';

const routes = [
    { 
        path: '/', 
        name: 'Index',
        component: Index,
    },
    {
        path: '/projects',
        name: 'ProjectList',
        component: ProjectList,
    },
    {
        path: '/project/:projectId',
        name: 'ProjectEditor',
        component: ProjectEditor,
        props: true,
    },
    // Legacy routes (kept for backward compat)
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
        name: 'EditorIndex',
        component: EditorIndex,
    },
    {
        path: '/editor/:songId',
        name: 'Editor',
        component: Editor,
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