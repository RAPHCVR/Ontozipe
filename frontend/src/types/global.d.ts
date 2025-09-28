﻿import type { JSX as ReactJSX } from "react";

declare global {
    namespace JSX {
        interface Element extends ReactJSX.Element {}
        interface ElementClass extends ReactJSX.ElementClass {}
        interface ElementAttributesProperty extends ReactJSX.ElementAttributesProperty {}
        interface ElementChildrenAttribute extends ReactJSX.ElementChildrenAttribute {}
        type ElementType = ReactJSX.ElementType;
        interface IntrinsicAttributes extends ReactJSX.IntrinsicAttributes {}
        interface IntrinsicClassAttributes<T> extends ReactJSX.IntrinsicClassAttributes<T> {}
        interface IntrinsicElements extends ReactJSX.IntrinsicElements {}
    }
}

export {};
