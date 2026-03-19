import type { MotionTrack, WolkProject } from '@/types/project_types';
import { fontDescriptorFromMotionStyle } from '@/front-end/utils/fonts/fontUtils';

export function collectSubtitleFonts(project: WolkProject, track: MotionTrack) {
    const fonts = [fontDescriptorFromMotionStyle(track.block.style, project.font)];

    for (const override of track.block.overrides || []) {
        if (override.styleOverride) {
            fonts.push(fontDescriptorFromMotionStyle({ ...track.block.style, ...override.styleOverride }, project.font));
        }
        for (const wordStyle of Object.values(override.wordStyleMap || {})) {
            fonts.push(fontDescriptorFromMotionStyle({ ...track.block.style, ...wordStyle }, project.font));
        }
    }

    return fonts;
}
