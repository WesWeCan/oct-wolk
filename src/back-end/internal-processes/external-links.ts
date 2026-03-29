import { shell } from 'electron';

export const normalizeExternalHttpUrl = (url: string): string => {
    const parsed = new URL(String(url));
    const protocol = parsed.protocol.toLowerCase();

    if (protocol !== 'http:' && protocol !== 'https:') {
        throw new Error('Unsupported URL protocol');
    }

    return parsed.toString();
};

export const openExternalHttpUrl = async (url: string): Promise<void> => {
    await shell.openExternal(normalizeExternalHttpUrl(url));
};
