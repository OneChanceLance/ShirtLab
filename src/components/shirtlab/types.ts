export type ImageObject = {
    id: string;
    type: 'image';
    imgUrl: string;
    img: HTMLImageElement;
    showHandles: boolean, // 👈 default to true
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    aspect: number;
    origW: number;
    origH: number;
    isSelected: boolean;
};

export type TextObject = {
    id: string;
    type: 'text';
    content: string;
    font: string;
    color: string;
    showHandles: boolean, // 👈 default to true
    outlineColor: string;
    outlineWidth: number;
    size: number;
    alignment: 'left' | 'center' | 'right';
    rotation: number;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;

    isSelected: boolean;
};

export type ColorOption = {
    /** Name */
    name: string;
    /** Color Code (hex) */
    color: string
}

export type FontOption = {
    /**
     * Human-readable font name, can include spaces.
     * Example: "Times New Roman"
     */
    name: string;
    /**
     * Optional internal ID for referencing programmatically without spaces.
     */
    key?: string;
    /**
     * CSS font-family string for usage in styles.
     */
    value: string;
    /**
     * Categories this font belongs to (e.g., serif, sans-serif, script, bold).
     */
    categories: string[];
    /**
     * Optional showcase styling for preview displays.
     */
    showcase?: {
        uppercase?: boolean;
        weight?: number | string;
        style?: string;
        size?: string;
    };
};

export type Category = {
    /** Display name of the category */
    name: string;
    /** One or more classification tags for filtering */
    tags: string[];
    /** CSS font-family for preview */
    fontFamily?: string;
    /** CSS font-size for preview */
    fontSize?: string;
    /** CSS font-weight for preview */
    fontWeight?: number | string;
    /** CSS font-style for preview */
    fontStyle?: string;
    /** Optional text-transform for preview */
    textTransform?: string;
};