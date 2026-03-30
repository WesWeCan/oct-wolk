import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import yauzl from 'yauzl';
import yazl from 'yazl';
import { isPathInsideRoot } from './internal-storage';

export interface ArchiveEntryInput {
    archivePath: string;
    sourcePath?: string;
    data?: Buffer | string;
}

const normalizeArchivePath = (inputPath: string): string => {
    const normalized = String(inputPath || '').replace(/\\/g, '/').replace(/^\/+/, '');
    if (!normalized || normalized === '.' || normalized.includes('\0')) {
        throw new Error('Invalid archive entry path');
    }
    const resolved = path.posix.normalize(normalized);
    if (!resolved || resolved === '.' || resolved.startsWith('../') || resolved.includes('/../')) {
        throw new Error(`Unsafe archive entry path: ${inputPath}`);
    }
    return resolved;
};

export const ensureFileExtension = (filePath: string, extension: string): string => {
    const trimmed = String(filePath || '').trim();
    const ext = `.${String(extension || '').replace(/^\./, '')}`;
    return trimmed.toLowerCase().endsWith(ext.toLowerCase()) ? trimmed : `${trimmed}${ext}`;
};

export const createTempDir = (prefix: string): string => {
    fs.mkdirSync(path.join(os.tmpdir(), prefix), { recursive: true });
    return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-${randomUUID()}-`));
};

export const removeDirIfExists = (dirPath: string): void => {
    try {
        fs.rmSync(dirPath, { recursive: true, force: true });
    } catch {
        // Best effort cleanup.
    }
};

export const listFilesRecursive = (rootDir: string): string[] => {
    const files: string[] = [];
    const visit = (currentDir: string) => {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                visit(fullPath);
                continue;
            }
            if (entry.isFile()) {
                files.push(fullPath);
            }
        }
    };

    if (fs.existsSync(rootDir)) {
        visit(rootDir);
    }

    return files;
};

export const copyDirectoryContents = (sourceDir: string, targetDir: string): void => {
    if (!fs.existsSync(sourceDir)) return;
    fs.mkdirSync(targetDir, { recursive: true });

    for (const filePath of listFilesRecursive(sourceDir)) {
        const relativePath = path.relative(sourceDir, filePath);
        const normalizedRelativePath = normalizeArchivePath(relativePath);
        const targetPath = path.join(targetDir, normalizedRelativePath);
        if (!isPathInsideRoot(targetPath, targetDir)) {
            throw new Error(`Refusing to copy outside target directory: ${relativePath}`);
        }
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.copyFileSync(filePath, targetPath);
    }
};

export const createZipArchive = async (outputPath: string, entries: ArchiveEntryInput[]): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        const zipFile = new yazl.ZipFile();
        const output = fs.createWriteStream(outputPath);

        output.on('close', () => resolve());
        output.on('error', reject);
        zipFile.outputStream.on('error', reject);
        zipFile.outputStream.pipe(output);

        for (const entry of entries) {
            const archivePath = normalizeArchivePath(entry.archivePath);
            if (typeof entry.sourcePath === 'string') {
                zipFile.addBuffer(fs.readFileSync(entry.sourcePath), archivePath);
                continue;
            }

            const buffer = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(String(entry.data ?? ''), 'utf-8');
            zipFile.addBuffer(buffer, archivePath);
        }

        zipFile.end();
    });
};

const openZipFile = async (archivePath: string): Promise<yauzl.ZipFile> => {
    return await new Promise<yauzl.ZipFile>((resolve, reject) => {
        yauzl.open(archivePath, { lazyEntries: true }, (error, zipFile) => {
            if (error) {
                reject(error);
                return;
            }
            if (!zipFile) {
                reject(new Error('Unable to open archive.'));
                return;
            }
            resolve(zipFile);
        });
    });
};

const readEntryBuffer = async (zipFile: yauzl.ZipFile, entry: yauzl.Entry): Promise<Buffer> => {
    return await new Promise<Buffer>((resolve, reject) => {
        zipFile.openReadStream(entry, (error, stream) => {
            if (error) {
                reject(error);
                return;
            }
            if (!stream) {
                reject(new Error(`Unable to read archive entry: ${entry.fileName}`));
                return;
            }

            const chunks: Buffer[] = [];
            stream.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    });
};

export const readZipEntries = async (archivePath: string): Promise<Map<string, Buffer>> => {
    const zipFile = await openZipFile(archivePath);

    return await new Promise<Map<string, Buffer>>((resolve, reject) => {
        const entries = new Map<string, Buffer>();

        const fail = (error: unknown) => {
            try {
                zipFile.close();
            } catch {
                // Ignore cleanup errors.
            }
            reject(error);
        };

        zipFile.on('error', fail);
        zipFile.on('entry', async (entry) => {
            try {
                const entryPath = normalizeArchivePath(entry.fileName);
                if (/\/$/.test(entry.fileName)) {
                    zipFile.readEntry();
                    return;
                }

                const buffer = await readEntryBuffer(zipFile, entry);
                entries.set(entryPath, buffer);
                zipFile.readEntry();
            } catch (error) {
                fail(error);
            }
        });
        zipFile.on('end', () => {
            try {
                zipFile.close();
            } catch {
                // Ignore cleanup errors.
            }
            resolve(entries);
        });

        zipFile.readEntry();
    });
};

export const extractZipArchive = async (archivePath: string, targetDir: string): Promise<string[]> => {
    const zipFile = await openZipFile(archivePath);

    return await new Promise<string[]>((resolve, reject) => {
        const writtenPaths: string[] = [];
        fs.mkdirSync(targetDir, { recursive: true });

        const fail = (error: unknown) => {
            try {
                zipFile.close();
            } catch {
                // Ignore cleanup errors.
            }
            reject(error);
        };

        zipFile.on('error', fail);
        zipFile.on('entry', (entry) => {
            const handleEntry = async () => {
                const normalizedEntryPath = normalizeArchivePath(entry.fileName);
                const destinationPath = path.join(targetDir, normalizedEntryPath);

                if (!isPathInsideRoot(destinationPath, targetDir)) {
                    throw new Error(`Archive entry escapes target directory: ${entry.fileName}`);
                }

                if (/\/$/.test(entry.fileName)) {
                    fs.mkdirSync(destinationPath, { recursive: true });
                    zipFile.readEntry();
                    return;
                }

                fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
                const buffer = await readEntryBuffer(zipFile, entry);
                fs.writeFileSync(destinationPath, buffer);
                writtenPaths.push(destinationPath);
                zipFile.readEntry();
            };

            handleEntry().catch(fail);
        });
        zipFile.on('end', () => {
            try {
                zipFile.close();
            } catch {
                // Ignore cleanup errors.
            }
            resolve(writtenPaths);
        });

        zipFile.readEntry();
    });
};
