declare module "vis-data" {
    export class DataSet<T = any> {
        constructor(items?: T[] | Record<string, any>, options?: Record<string, any>);
        add(items: T | T[]): T[];
        update(items: T | T[]): T[];
        remove(ids: string | number | Array<string | number>): T[];
        get(id?: string | number | Array<string | number>): T | T[];
        on(event: string, callback: (...args: any[]) => void): void;
        off(event: string, callback: (...args: any[]) => void): void;
    }

    export class DataView<T = any> {
        constructor(dataset: DataSet<T>, options?: Record<string, any>);
        get(): T[];
    }

    export type Queue<T = any> = Array<T>;
}

declare module "vis-data/esnext" {
    export * from "vis-data";
}

declare module "vis-util" {
    export type Point3d = any;
    export type Point2d = any;
    export type BoundingBoxItem = any;
    export type ConfiguratorConfig = any;
    export type ConfiguratorHideOption = any;
    export type OptionsConfig = any;
}

declare module "vis-util/esnext" {
    export * from "vis-util";
}
