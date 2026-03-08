export interface SystemFontFile {
    familyGuess: string;
    filePath: string;
    fileName: string;
    guessStyle?: 'normal' | 'italic' | 'oblique';
    guessWeight?: number;
}

export const FontsService = {
    async list(): Promise<SystemFontFile[]> {
        const list = await window.electronAPI.fonts.list();
        return Array.isArray(list) ? list as SystemFontFile[] : [];
    },
    async addToProject(documentId: string, systemFontFilePath: string): Promise<string | null> {
        try {
            const res = await window.electronAPI.export.copyFontsForExport(documentId, [systemFontFilePath]);
            const absPath = Array.isArray(res?.copied) && res.copied[0] ? String(res.copied[0]) : '';
            if (!absPath) return null;
            // Build wolk:// URL relative to storage root: wolk://{documentId}/fonts/{fileName}
            const fileName = absPath.split('/').pop() || '';
            return `wolk://${documentId}/fonts/${fileName}`;
        } catch {
            return null;
        }
    }
};

export const FontName = {
    fromFileName(fileName: string): string {
        const base = (fileName || '').split('/').pop() || '';
        const noExt = base.replace(/\.(ttf|otf|woff2?|TTF|OTF|WOFF2?)$/, '');
        return noExt;
    }
};


