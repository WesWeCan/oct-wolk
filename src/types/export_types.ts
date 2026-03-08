export interface ExportRenderSettings {
    fps: number;
    renderWidth: number;
    renderHeight: number;
    includeAudio?: boolean;
    exportBitrateMbps?: number;
    exportMode?: 'realtime' | 'frames';
    fontFamily?: string;
    fontFallbacks?: string[];
    fontStyle?: 'normal' | 'italic' | 'oblique';
    fontWeight?: number | 'normal' | 'bold' | 'bolder' | 'lighter';
    fontName?: string;
    fontLocalPath?: string;
}

export interface ExportDocument {
    id: string;
    title: string;
    audioSrc?: string | null;
    settings: ExportRenderSettings;
    hasPendingRuntimeModules?: boolean;
}
