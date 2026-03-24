import { registerMotionBlockPlugin, setFallbackMotionBlockPlugin } from '@/front-end/motion-blocks/core/registry';
import { unsupportedMotionBlockPlugin } from '@/front-end/motion-blocks/core/unsupported-plugin';
import { cloudMotionBlockPlugin } from '@/front-end/motion-blocks/cloud/plugin';
import { subtitleMotionBlockPlugin } from '@/front-end/motion-blocks/subtitle/plugin';

let bootstrapped = false;

export function ensureMotionBlockPluginsRegistered(): void {
    if (bootstrapped) return;
    registerMotionBlockPlugin(unsupportedMotionBlockPlugin);
    registerMotionBlockPlugin(subtitleMotionBlockPlugin);
    registerMotionBlockPlugin(cloudMotionBlockPlugin);
    setFallbackMotionBlockPlugin(unsupportedMotionBlockPlugin);
    bootstrapped = true;
}

export { cloudMotionBlockPlugin };
export { subtitleMotionBlockPlugin };
