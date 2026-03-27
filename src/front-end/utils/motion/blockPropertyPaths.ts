import type { MotionBlock } from '@/types/project_types';

const isObject = (value: unknown): value is Record<string, any> => {
    return !!value && typeof value === 'object' && !Array.isArray(value);
};

export const getMotionBlockPropertyValue = (block: MotionBlock, path: string): any => {
    const parts = path.split('.');
    let current: any = block;

    for (const part of parts) {
        if (!isObject(current) && !Array.isArray(current)) return undefined;
        current = current[part];
    }

    return current;
};

export const setMotionBlockPropertyValue = (block: MotionBlock, path: string, value: any): MotionBlock => {
    const parts = path.split('.');
    if (parts.length === 0) return block;

    const nextBlock: MotionBlock = {
        ...block,
        style: { ...block.style },
        transform: { ...block.transform },
        enter: {
            ...block.enter,
            fade: { ...block.enter.fade },
            move: { ...block.enter.move },
            scale: { ...block.enter.scale },
        },
        exit: {
            ...block.exit,
            fade: { ...block.exit.fade },
            move: { ...block.exit.move },
            scale: { ...block.exit.scale },
        },
        overrides: [...block.overrides],
        params: JSON.parse(JSON.stringify(block.params || {})),
        propertyTracks: [...(block.propertyTracks || [])],
    };

    let current: any = nextBlock;
    for (let index = 0; index < parts.length - 1; index++) {
        const part = parts[index];
        if (!isObject(current[part])) current[part] = {};
        current = current[part];
    }

    current[parts[parts.length - 1]] = value;
    return nextBlock;
};
