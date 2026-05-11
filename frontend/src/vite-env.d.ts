declare const __APP_VERSION__: string;

declare module '*.css';

declare module '*.png' {
    const src: string;
    export default src;
}
