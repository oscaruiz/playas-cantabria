declare module 'glob' {
    export default function glob(pattern: string, options?: any): Promise<string[]>;
}
