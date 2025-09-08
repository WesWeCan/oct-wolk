export interface SystemFontFile {
    familyGuess: string;
    filePath: string;
    fileName: string;
}

export const FontsService = {
    async list(): Promise<SystemFontFile[]> {
        const list = await window.electronAPI.fonts.list();
        return Array.isArray(list) ? list as SystemFontFile[] : [];
    },
};


