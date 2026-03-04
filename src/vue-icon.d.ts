declare module '@jamescoyle/vue-icon' {
    import type { DefineComponent } from 'vue';
    const SvgIcon: DefineComponent<{
        type?: string;
        path?: string;
        size?: string | number;
    }>;
    export default SvgIcon;
}
