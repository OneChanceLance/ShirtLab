import type { FontOption, Category } from '../../shirtlab/types';

export const FONT_OPTIONS: Record<string, FontOption> = {
    'Arial': { name: 'Arial', value: 'Arial, sans-serif', categories: ['sans-serif'] },
    'Times New Roman': { name: 'Times New Roman', value: '"Times New Roman", serif', categories: ['serif'] },
    'Verdana': { name: 'Verdana', value: 'Verdana, sans-serif', categories: ['sans-serif'] },
    'Tahoma': { name: 'Tahoma', value: 'Tahoma, sans-serif', categories: ['sans-serif'] },
    'Trebuchet MS': { name: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif', categories: ['sans-serif'] },
    'Georgia': { name: 'Georgia', value: 'Georgia, serif', categories: ['serif'] },
    'Garamond': { name: 'Garamond', value: 'Garamond, serif', categories: ['serif'] },
    'Courier New': { name: 'Courier New', value: '"Courier New", monospace', categories: ['monospace'] },
    'Lucida Console': { name: 'Lucida Console', value: '"Lucida Console", monospace', categories: ['monospace'] },
    'Monaco': { name: 'Monaco', value: 'Monaco, monospace', categories: ['monospace'] },
    'Brush Script MT': { name: 'Brush Script MT', value: '"Brush Script MT", cursive', categories: ['script', 'cursive'] },
    'Dancing Script': { name: 'Dancing Script', value: '"Dancing Script", cursive', categories: ['script', 'cursive'] },
    'Gloria Hallelujah': { name: 'Gloria Hallelujah', value: '"Gloria Hallelujah", cursive', categories: ['handwritten', 'cursive'] },
    'Stardos Stencil': { name: 'Stardos Stencil', value: '"Stardos Stencil", serif', categories: ['stencil', 'display'] },
    'Impact': { name: 'Impact', value: 'Impact, sans-serif', categories: ['sans-serif', 'display'] },
    'Cerulya CF': { name: 'Cerulya CF', value: '"cerulya-cf", sans-serif', categories: ['sans-serif'] },
    'Casey Classic': { name: 'Casey Classic', value: 'Casey Classic', categories: ['display'], showcase: { weight: 500 } },
    // Adobe fonts and other real fonts, with categories
    'Shrunken Head BB': { name: 'Shrunken Head BB', value: '"shrunken-head-bb", sans-serif', categories: ['display', 'comic'] },
    'Shrunken Head LT BB': { name: 'Shrunken Head LT BB', value: '"shrunken-head-lt-bb", sans-serif', categories: ['display', 'comic', 'light'] },
    'Amandine': { name: 'Amandine', value: 'amandine, sans-serif', categories: ['sans-serif', 'rounded'] },
    'Dreaming Outloud Sans': { name: 'Dreaming Outloud Sans', value: '"dreaming-outloud-sans", sans-serif', categories: ['handwritten', 'sans-serif'] },
    'Dreaming Outloud Script': { name: 'Dreaming Outloud Script', value: '"dreaming-outloud-script", cursive', categories: ['script', 'handwritten'] },
    'Dreaming Outloud Script Slant': { name: 'Dreaming Outloud Script Slant', value: '"dreaming-outloud-scriptslant", cursive', categories: ['script', 'handwritten', 'italic'] },
    'Megascope Variable': { name: 'Megascope Variable', value: '"megascope-variable", sans-serif', categories: ['sans-serif', 'variable'] },
    'Meursault Variable': { name: 'Meursault Variable', value: '"meursault-variable", serif', categories: ['serif', 'variable'] },
    'BD Orange Variable': { name: 'BD Orange Variable', value: '"bd-orange-variable", sans-serif', categories: ['sans-serif', 'variable', 'bold'] },
    'Aquatronik Variable': { name: 'Aquatronik Variable', value: '"aquatronik-variable", sans-serif', categories: ['sans-serif', 'variable', 'tech'] },
    // More script fonts
    'Kalufira': { name: 'Kalufira', value: '"Kalufira"', categories: ['script'] },
    'Street Breaker': { name: 'Street Breaker', value: '"Street Breaker", cursive', categories: ['script'] },
    'Nordminne Script': { name: 'Nordminne Script', value: '"Nordminne Script", cursive', categories: ['script'] },
    'Birds of Paradise': { name: 'Birds of Paradise', value: '"Birds of Paradise", cursive', categories: ['script'] },
    'Muthiara': { name: 'Muthiara', value: 'Muthiara', categories: ['script'] },
    'Dear Script': { name: 'Dear Script', value: '"Dear Script", cursive', categories: ['script'] },
    'Tempting': { name: 'Tempting', value: '"Tempting", cursive', categories: ['script'] },
    'Cream Cake': { name: 'Cream Cake', value: '"Cream Cake", cursive', categories: ['script'] },
    'Motterrdam': { name: 'Motterrdam', value: '"Motterrdam", cursive', categories: ['script'] },
    'Floralis Couture': { name: 'Floralis Couture', value: '"Floralis Couture", cursive', categories: ['script', 'handwritten'] },
    'Hello Valentica': { name: 'Hello Valentina', value: '"Hello Valentica", cursive', categories: ['script'] },
    'Autography': { name: 'Autography', value: '"Autography", cursive', categories: ['script'] },
    'Ananda': { name: 'Ananda', value: '"Ananda", cursive', categories: ['script'] },
    'Blacksword': { name: 'Blacksword', value: '"Blacksword", cursive', categories: ['script'] },
    'Blockt': { name: 'Blockt', value: '"Blockt"', categories: ['display', 'bold'] },
    'Carbon': { name: 'Carbon', value: '"Carbon"', categories: ['tech', 'sans-serif'] },
    'Block Wood': { name: 'Block Wood', value: '"Block Wood"', categories: ['display', 'stencil'] },
    'Wet Arial': { name: 'Wet Arial', value: '"Wet Arial"', categories: ['sans-serif', 'handwritten'] },
    'College': { name: 'College', value: '"College"', categories: ['display'] },
    'Colleges': { name: 'Colleges', value: '"Colleges"', categories: ['display'] },
    'Dark College': { name: 'Dark College', value: '"Dark College"', categories: ['display'] },
    'Fine College': { name: 'Fine College', value: '"Fine College"', categories: ['display'] },
    'Superstar': { name: 'Superstar', value: '"Superstar"', categories: ['display'] },
    'Rats College': { name: 'Rats College', value: '"Rats College"', categories: ['display'] },



};

export const CATEGORY_STYLES: Record<string, Category> = {
    'serif': {
        name: 'Serif',
        tags: ['serif'],
        fontFamily: 'serif',
        fontSize: '1.5rem'
    },
    'sans-serif': {
        name: 'Sans-serif',
        tags: ['sans-serif', 'sans'],
        fontFamily: 'sans-serif',
        fontSize: '1.5rem'
    },
    'bold': {
        name: 'Bold',
        tags: ['bold', 'heavy', 'strong'],
        fontWeight: 'bold',
        fontSize: '1.5rem'
    },
    'thin': {
        name: 'Thin',
        tags: ['thin', 'light', 'slim'],
        fontWeight: 200,
        fontSize: '1.5rem'
    },
    'retro': {
        name: 'Retro',
        tags: ['retro', 'vintage'],
        fontFamily: '"Retro", cursive',
        fontSize: '1.5rem'
    },
    'script': {
        name: 'Script',
        tags: ['script', 'cursive'],
        fontFamily: '"Dancing Script", cursive',
        fontSize: '1rem',

    },
    'handwritten': {
        name: 'Handwritten',
        tags: ['handwritten', 'handwriting'],
        fontFamily: '"Gloria Hallelujah", cursive',
        fontSize: '1.2rem',
        textTransform: 'uppercase'
    },
    'stencil': {
        name: 'Stencil',
        tags: ['stencil'],
        fontFamily: '"Stardos Stencil", serif',
        fontSize: '1.5rem',
        fontWeight: 700
    },
    'display': {
        name: 'Display',
        tags: ['display', 'headline', 'title'],
        fontFamily: 'Impact, "Stardos Stencil", system-ui, sans-serif',
        fontSize: '1.8rem',
        fontWeight: 700
    },
    'monospace': {
        name: 'Monospace',
        tags: ['monospace', 'code'],
        fontFamily: '"Courier New", monospace',
        fontSize: '1.3rem'
    },
    'tech': {
        name: 'Tech',
        tags: ['tech', 'sci-fi', 'futuristic'],
        fontFamily: '"Carbon", system-ui, sans-serif',
        fontSize: '1.4rem',
        fontWeight: 500
    }
};

export const CATEGORIES = Object.keys(CATEGORY_STYLES);
