import { ref } from 'vue';
import { useRouter } from 'vue-router';

/**
 * .wolk file import management.
 * 
 * Responsibilities:
 * - Import dialog state
 * - File picking
 * - Import strategy (copy vs override)
 * - Error handling
 * 
 * @example
 * ```typescript
 * const importer = useWolkImport();
 * 
 * importer.openDialog();
 * // User picks file...
 * await importer.doImport();
 * ```
 */
export function useWolkImport() {
    const router = useRouter();
    
    const showDialog = ref(false);
    const strategy = ref<'copy' | 'override'>('copy');
    const file = ref<File | null>(null);
    const isImporting = ref(false);
    const error = ref<string | null>(null);
    
    /**
     * Opens the import dialog.
     */
    const openDialog = () => {
        showDialog.value = true;
        strategy.value = 'copy';
        file.value = null;
        error.value = null;
    };
    
    /**
     * Closes the import dialog.
     */
    const closeDialog = () => {
        showDialog.value = false;
        file.value = null;
        error.value = null;
    };
    
    /**
     * Handles file selection from input.
     */
    const pickFile = (event: Event) => {
        const input = event.target as HTMLInputElement;
        const files = input.files;
        
        file.value = files && files[0] ? files[0] : null;
    };
    
    /**
     * Executes the import operation.
     */
    const doImport = async () => {
        if (!file.value) {
            error.value = 'Choose a .wolk file';
            return;
        }
        
        try {
            isImporting.value = true;
            error.value = null;
            
            // Read file as ArrayBuffer
            const arrayBuffer = await file.value.arrayBuffer();
            
            // Send to Electron backend
            const res = await (window as any).electronAPI.export.importWolkBytes(
                arrayBuffer,
                strategy.value
            );
            
            if (res?.songId) {
                // Success - navigate to imported song
                closeDialog();
                await router.push({
                    name: 'Editor',
                    params: { songId: res.songId }
                });
            } else {
                error.value = String(res?.error || 'Import failed. Please check the file.');
            }
        } catch (e: any) {
            error.value = String(e?.message || 'Import error');
        } finally {
            isImporting.value = false;
        }
    };
    
    return {
        showDialog,
        strategy,
        file,
        isImporting,
        error,
        openDialog,
        closeDialog,
        pickFile,
        doImport,
    };
}
