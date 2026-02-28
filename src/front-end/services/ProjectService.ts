import type { WolkProject } from '@/types/project_types';

export const ProjectService = {
    async create(initial?: { title?: string; audioSrc?: string; coverSrc?: string }): Promise<WolkProject> {
        const project = await window.electronAPI.projects.create(initial);
        return project as WolkProject;
    },

    async save(project: WolkProject): Promise<WolkProject> {
        const payload = JSON.parse(JSON.stringify(project));
        const saved = await window.electronAPI.projects.save(payload);
        return saved as WolkProject;
    },

    async load(projectId: string): Promise<WolkProject | null> {
        const project = await window.electronAPI.projects.load(projectId);
        return (project || null) as WolkProject | null;
    },

    async list(): Promise<WolkProject[]> {
        const list = await window.electronAPI.projects.list();
        return (Array.isArray(list) ? list : []) as WolkProject[];
    },

    async delete(projectId: string): Promise<boolean> {
        const ok = await window.electronAPI.projects.delete(projectId);
        return !!ok;
    },

    async uploadAudio(projectId: string, file: File): Promise<WolkProject> {
        const arrayBuffer = await file.arrayBuffer();
        const updated = await window.electronAPI.projects.uploadAudio(projectId, arrayBuffer, file.name);
        return updated as WolkProject;
    },

    async uploadCover(projectId: string, file: File): Promise<WolkProject> {
        const arrayBuffer = await file.arrayBuffer();
        const updated = await window.electronAPI.projects.uploadCover(projectId, arrayBuffer, file.name);
        return updated as WolkProject;
    },

    async uploadAsset(projectId: string, file: File, preferredFileName?: string): Promise<{ url: string; fileName: string }> {
        const arrayBuffer = await file.arrayBuffer();
        const res = await window.electronAPI.projects.uploadAsset(projectId, arrayBuffer, file.name, preferredFileName);
        return res as { url: string; fileName: string };
    },
};
