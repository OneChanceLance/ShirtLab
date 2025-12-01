<template>
    <div v-if="selectedText && selectedText?.type == 'text'">
        <div v-if="currentMenu == 'menu'" class="font-container">

            <input type="text" placeholder="Enter Text Here" v-model="textContent">
            <div id="customize">
                <button class="customize-btn" @click="$emit('duplicate-text')">
                    <img id="duplicate" class="icon" src="./duplicate.png"><span>Duplicate</span>
                </button>
                <button class="customize-btn" @click="$emit('bring-forward')">
                    <img id="bringForward" class="icon" src="./bringForward.png"><span>Bring Forward</span>
                </button>
                <button class="customize-btn" @click="$emit('send-back')">
                    <img id="sendBack" class="icon" src="./sendBack.png"><span>Send Back</span>
                </button>
                <button class="customize-btn" @click="$emit('center-text')">
                    <img id="center" class="icon" src="./center.png"><span>Center</span>
                </button>
            </div>

            <hr>

            <TextConfig label="Font" @click="togglePage('font')">
                <span :style="currentFontPreviewStyle">
                    {{ currentFontOption.name }}
                </span>


                <div id="textStyles" :class="{ disabled: !currentFontHasBoldVariant }">
                    <button type="button" class="textStyleControl" :class="{ active: isBoldActive }"
                        :disabled="!currentFontHasBoldVariant" @click.stop="toggleBold">
                        B
                    </button>
                    <button type="button" class="textStyleControl" :class="{ active: isItalicActive }"
                        :disabled="!currentFontHasBoldVariant" @click.stop="toggleItalic">
                        I
                    </button>
                    <button type="button" class="textStyleControl" :class="{ active: isUnderlineActive }"
                        :disabled="!currentFontHasBoldVariant" @click.stop="toggleUnderline">
                        U
                    </button>
                </div>
            </TextConfig>
            <hr>
            <TextConfig label="Color" @click="togglePage('color')">
                <span :style="{ display: 'flex', alignItems: 'center', gap: '1rem' }">{{ textColor }}
                    <div class="color-box"
                        :style="{ height: '2rem', width: '2rem', backgroundColor: textColor, borderRadius: '5px' }">
                    </div>
                </span>
            </TextConfig>
            <hr>
            <TextConfig label="Outline Color" @click="togglePage('outline')">
                <span :style="{ display: 'flex', alignItems: 'center', gap: '1rem' }">{{ outlineColor }}
                    <div class="color-box"
                        :style="{ height: '2rem', width: '2rem', backgroundColor: outlineColor, borderRadius: '5px' }">
                    </div>
                </span>
            </TextConfig>
            <hr>
            <TextConfig label="Size (height in inches)" noArrow>
                <input v-model.number="textSizeIn" style="max-width:30%; border-width:1px;" />
            </TextConfig>
            <hr>
            <TextConfig label="Effect" @click="togglePage('effect')">
                Select Effect
            </TextConfig>
            <hr>
            <TextConfig label="Alignment" noArrow>
                <TabOption :options="alignmentOptions" v-model="alignmentModel" valueKey="label" />
            </TextConfig>
            <hr>

        </div>

        <div v-else-if="currentMenu == 'font'" class="font-list">
            <!-- Search -->
            <div class="search-bar">
                <input type="text" placeholder="Search Fonts and Styles" v-model="searchQuery" ref="search" />
                <span class="search-icon">🔍</span>
            </div>

            <!-- Search Results -->
            <div v-if="searchQuery.trim()" class="font-search-results">
                <button id="allFontButton" @click="searchQuery = ''" style="display: flex; line-height: 1rem;"><svg
                        xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3"
                        stroke="currentColor" class="size-6">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                    </svg>
                    All Font Categories</button>
                <div v-for="font in filteredFontOptions" :key="font.name" @click="textFont = font.value"
                    class="font-option">
                    <span :style="{ fontSize: '1.25rem', fontWeight: 200 }">{{ font.name }}</span>
                    <span :style="{
                        fontFamily: font.value, cursor: 'pointer', fontSize: font.showcase?.size || 'x-large',
                        fontWeight: font.showcase?.weight || 'normal', fontStyle: font.showcase?.style || 'normal',
                        textTransform: font.showcase?.uppercase ? 'uppercase' : 'none',
                    }">{{ selectedText?.content }}</span>
                </div>
            </div>

            <!-- Roster: font category showcase buttons -->
            <div v-else class="showcase">
                <button v-for="cat in CATEGORY_STYLES" :key="cat.name" class="showcase option"
                    @click="searchQuery = cat.name">
                    <span
                        :style="{ fontFamily: cat.fontFamily, fontSize: cat.fontSize, fontWeight: cat.fontWeight, fontStyle: cat.fontStyle }">{{
                            cat.name }}</span>
                </button>
            </div>
        </div>

        <div v-else-if="currentMenu == 'color'" class="color-list">
            <span style="display: flex; font-weight: 300;">Select Color</span>

            <div class="columnContainer" :style="{ display: 'flex' }">
                <!-- Left Div -->
                <div class="leftColumn" :style="{ display: 'flex' }">
                    <div class="color-swatch" :style="{
                        background: textColor === 'None'
                            ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                            : textColor
                    }"></div>
                    {{ textColor }}
                </div>

                <!-- Right Div -->
                <div class="rightColumn">
                    <!-- Color swatches -->
                    <div class="swatches">
                        <div v-for="color in COLOR_OPTIONS" :key="color.name" class="color-swatch"
                            @click="textColor = color.color" :style="{
                                background: color.name === 'None'
                                    ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                                    : color.color,
                                boxSizing: 'border-box',
                                border: color.name === 'White' ? '1px solid black' : 'none'
                            }">
                            <svg v-if="textColor === color.color" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                                fill="none" stroke="lightgreen" stroke-width="3" stroke-linecap="round"
                                stroke-linejoin="round" class="checkmark">
                                <path d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <div class="bottom">
                        <label class="low-contrast-toggle">
                            <input type="checkbox" v-model="lowContrast" />
                            <span class="label-text">
                                Low Contrast
                                <span class="color-word">Color
                                    <span class="hit-bubble" aria-label="info">?</span>
                                    <span class="tooltip" role="tooltip">Low-contrast colros are colors that are similar
                                        in brightness. Colors of similar contrast (such as white and yellow) are often
                                        harder to distinguish, potentially making your text/image difficult to read or
                                        see. <br />
                                        <br />
                                        For maximum legibility, consider pairing colors with higher contrast (such as
                                        black and white)
                                        . </span>
                                </span>
                            </span>
                        </label>
                        <div class="colorPicker" @click="onPickColor"><svg viewBox="0 0 128 128" width="1em"
                                height="1em" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eyedropper">
                                <g transform="rotate(-45 64 64)">
                                    <circle cx="102" cy="64" r="18" fill="#A4C74D" />
                                    <rect x="20" y="54" width="80" height="20" rx="10" fill="#A4C74D" />
                                    <rect x="14" y="58" width="16" height="12" rx="6" fill="#A4C74D" />
                                    <rect x="40" y="58" width="22" height="12" rx="6" fill="#FFFFFF" opacity="1" />
                                </g>
                            </svg>Use a color in your design</div>
                    </div>

                    <div class="submit" @click="backPage()">Done</div>
                </div>
            </div>
        </div>

        <div v-else-if="currentMenu == 'outline'" class="color-list">
            <span style="display: flex; ">Select Outline Color</span>

            <div class="columnContainer" :style="{ display: 'flex' }">
                <!-- Left Div -->
                <div class="leftColumn" :style="{ display: 'flex' }">
                    <div class="color-swatch" :style="{
                        background: outlineColor === 'None'
                            ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                            : outlineColor
                    }"></div>
                    {{ outlineColor }}
                </div>

                <!-- Right Div -->
                <div class="rightColumn">
                    <!-- Color swatches -->
                    <div class="swatches">
                        <div v-for="color in COLOR_OPTIONS" :key="color.name" class="color-swatch"
                            @click="outlineColor = color.color" :style="{
                                background: color.name === 'None'
                                    ? 'repeating-conic-gradient(#ccc 0% 25%, transparent 0% 50%) 50% / 10px 10px'
                                    : color.color
                            }">
                            <svg v-if="outlineColor === color.color" xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24" fill="none" stroke="lightgreen" stroke-width="3"
                                stroke-linecap="round" stroke-linejoin="round" class="checkmark">
                                <path d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                    </div>

                    <div class="bottom">
                        <label class="low-contrast-toggle">
                            <input type="checkbox" v-model="lowContrast" />
                            <span class="label-text">
                                Low Contrast
                                <span class="color-word">Color
                                    <span class="hit-bubble" aria-label="info">?</span>
                                    <span class="tooltip" role="tooltip">Lower-contrast choices for subtle
                                        outlines.</span>
                                </span>
                            </span>
                        </label>
                        <div class="colorPicker" @click="onPickColor"><svg viewBox="0 0 128 128" width="1em"
                                height="1em" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Eyedropper">
                                <g transform="rotate(-45 64 64)">
                                    <circle cx="102" cy="64" r="18" fill="#A4C74D" />
                                    <rect x="20" y="54" width="80" height="20" rx="10" fill="#A4C74D" />
                                    <rect x="14" y="58" width="16" height="12" rx="6" fill="#A4C74D" />
                                    <rect x="40" y="58" width="22" height="12" rx="6" fill="#FFFFFF" opacity="1" />
                                </g>
                            </svg>Use a color in your design</div>
                    </div>
                </div>
            </div>

            <span style="display: flex;">Choose Outline Thickness</span>
            <div class="thickness">
                <WeightSlider v-model="outlineWidth" :min="0" :max="6" :step="1" />
            </div>
            <div :style="{ display: 'flex', margin: '1rem', marginLeft: '10rem' }">
                <div class="outline" @click="outlineWidth = 0">Remove Outline</div>
                <div class="submit" @click="backPage()">Done</div>
            </div>
        </div>

        <div v-else-if="currentMenu == 'effect'" class="effect-list">
            <span style="display: flex;">Select text effect</span>

            <div :style="{ display: 'flex', margin: '0 auto' }">
                <div>
                    <div class="effect-swatches">
                        <div v-for="effect in EFFECTS" :key="effect.key"
                            :class="['effect-swatch', { active: effectName === effect.key }]"
                            @click="effectName = effect.key">
                            <span>{{ effect.label }}</span>
                        </div>
                    </div>


                </div>
            </div>

            <span style="display: flex;">Effect Intensity</span>
            <div class="thickness">
                <WeightSlider v-model="effectStrength" :min="0" :max="6" :step="1" />
            </div>
            <div :style="{ display: 'flex', margin: '1rem', marginLeft: '10rem' }">
                <div class="outline" @click="effectName = 'none'">Remove Effect</div>
                <div class="submit" @click="backPage()">Done</div>
            </div>
        </div>

    </div>

    <div v-else class="font-container">
        <input ref="newTextEl" type="text" placeholder="Enter Text Here">
        <button id="apply" @click="applyText()">Apply to Design</button>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import TextConfig from './TextAssets/TextConfig.vue';
    import TabOption from './TabOption.vue';
    import { FONT_OPTIONS, CATEGORY_STYLES } from './types/fontList';
    import { COLOR_OPTIONS } from './types/colorList';
    import WeightSlider from './TextAssets/WeightSlider.vue';
    import { EFFECTS, withDefaults } from './types/effectsList';
    import type { EffectName, EffectOptions, TextObject, ImageObject, FontOption } from '../shirtlab/types';

    const searchQuery = ref('');
    const props = defineProps<{
        selectedObject: TextObject | ImageObject | null
        draw: () => void;
    }>();
    const selectedText = computed<TextObject | null>(() => {
        return props.selectedObject && props.selectedObject.type === 'text'
            ? (props.selectedObject as TextObject)
            : null;
    });
    const emit = defineEmits<{
        (e: 'uploadText', payload: string): void;
        (e: 'changeMenu', menu: string): void;
        (e: 'backMenu'): void;
        (e: 'center-text'): void;
        (e: 'duplicate-text'): void;
        (e: 'bring-forward'): void;
        (e: 'send-back'): void;
    }>();

    const effectName = computed<EffectName>({
        get: () => selectedText.value?.effect?.name ?? 'none',
        set: (name) => setText({ effect: { name, options: withDefaults(name) } }),
    });
    const effectStrength = effectOptProxy('strength', 1);
    const textContent = propProxy('content', '');
    const textFont = propProxy('font', 'Arial');
    const textColor = propProxy('color', '#000000');
    const outlineColor = propProxy('outlineColor', '#000000');
    const outlineWidth = propProxy('outlineWidth', 0);
    const textSizeIn = propProxy('size', 10);
    const alignmentModel = propProxy('alignment', 'left');
    const fontWeightModel = propProxy('fontWeight', 'normal' as any);
    const fontStyleModel = propProxy('fontStyle', 'normal' as any);
    const underlineModel = propProxy('underline', false as any);

    const newTextEl = ref<HTMLInputElement | null>(null);
    const lowContrast = ref(false);
    const currentMenu = ref('menu');

    // ---------- ONE UPDATER ----------
    function setText(updates: Partial<TextObject>) {
        const t = selectedText.value;
        if (!t) return;
        Object.assign(t, updates);
        requestAnimationFrame(() => props.draw());
    }

    function propProxy<K extends keyof TextObject>(key: K, fallback: TextObject[K]) {
        return computed<TextObject[K]>({
            get: () => (selectedText.value ? selectedText.value[key] : fallback),
            set: (v) => setText({ [key]: v } as Pick<TextObject, K>),
        });
    }

    function effectOptProxy<K extends keyof EffectOptions>(key: K, fallback: EffectOptions[K]) {
        return computed<EffectOptions[K]>({
            get: () => selectedText.value?.effect?.options?.[key] ?? fallback,
            set: (v) => {
                const cur = selectedText.value?.effect ?? { name: 'none', options: withDefaults('none') };
                setText({ effect: { ...cur, options: { ...cur.options, [key]: v } } });
            },
        });
    }

    // derived for the “Font” row preview
    const currentFontOption = computed<FontOption>(() => {
        const font = selectedText.value?.font;
        const all = Object.values(FONT_OPTIONS);
        if (!font) return all[0];
        return all.find(f => f.value === font) ?? all[0];
    });

    const currentFontPreviewStyle = computed(() => {
        const base = currentFontOption.value;
        const size = base.showcase?.size || 'x-large';
        const weight = selectedText.value?.fontWeight ?? base.showcase?.weight ?? 'normal';
        const style = selectedText.value?.fontStyle ?? base.showcase?.style ?? 'normal';
        const underline = selectedText.value?.underline ?? false;
        return {
            fontFamily: base.value,
            cursor: 'pointer',
            fontSize: size,
            fontWeight: weight,
            fontStyle: style,
            textTransform: base.showcase?.uppercase ? 'uppercase' : 'none',
            textDecoration: underline ? 'underline' : 'none',
        } as Record<string, string | number>;
    });

    const currentFontHasBoldVariant = computed(() => {
        if (typeof document === 'undefined') return true;
        const family = currentFontOption.value.value;
        const fonts = (document as any).fonts;
        if (!fonts || typeof fonts.check !== 'function') return true;
        try {
            return fonts.check(`700 16px ${family}`);
        } catch {
            return true;
        }
    });

    const isBoldActive = computed(() => {
        const w = fontWeightModel.value;
        return w === 700 || w === '700' || w === 'bold';
    });

    const isItalicActive = computed(() => fontStyleModel.value === 'italic');
    const isUnderlineActive = computed(() => Boolean(underlineModel.value));

    // alignment options for TabOption
    const alignmentOptions = ref<{ label: TextObject["alignment"] }[]>([
        { label: 'left' }, { label: 'center' }, { label: 'right' },
    ]);

    function toggleBold() {
        if (!currentFontHasBoldVariant.value) return;
        fontWeightModel.value = isBoldActive.value ? 'normal' as any : 700 as any;
    }

    function toggleItalic() {
        if (!currentFontHasBoldVariant.value) return;
        fontStyleModel.value = isItalicActive.value ? 'normal' as any : 'italic' as any;
    }

    function toggleUnderline() {
        if (!currentFontHasBoldVariant.value) return;
        underlineModel.value = !isUnderlineActive.value as any;
    }

    // ---------- SEARCH ----------
    const filteredFontOptions = computed(() => {
        const q = searchQuery.value.trim().toLowerCase();

        const isExactCategoryOrTag = Object.entries(CATEGORY_STYLES).some(([catKey, cat]) => {
            return catKey.toLowerCase() === q || cat.tags?.some(tag => tag.toLowerCase() === q);
        });

        return Object.values(FONT_OPTIONS).filter(f => {
            if (f.name.toLowerCase().includes(q)) return true;
            if (isExactCategoryOrTag) {
                return f.categories?.some(c => {
                    const category = CATEGORY_STYLES[c];
                    return category && (c.toLowerCase() === q || category.tags?.some(tag => tag.toLowerCase() === q));
                });
            }
            return false;
        });
    });

    // ---------- HANDLERS ----------


    async function pickColorViaEyeDropper(): Promise<string | null> {
        try {
            // @ts-ignore - EyeDropper is experimental
            if (typeof window !== 'undefined' && 'EyeDropper' in window) {
                // @ts-ignore
                const eyeDropper = new window.EyeDropper();
                const result = await eyeDropper.open();
                return result?.sRGBHex ?? null;
            }
        } catch { }
        return await new Promise<string | null>((resolve) => {
            const input = document.createElement('input');
            input.type = 'color';
            input.style.position = 'fixed';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            document.body.appendChild(input);
            const finish = () => {
                const val = input.value || null;
                if (document.body.contains(input)) input.remove();
                resolve(val);
            };
            input.addEventListener('input', finish, { once: true });
            input.addEventListener('change', finish, { once: true });
            input.addEventListener('blur', () => {
                setTimeout(() => { if (document.body.contains(input)) input.remove(); resolve(null); }, 0);
            }, { once: true });
            input.click();
        });
    }

    async function onPickColor() {
        const hex = await pickColorViaEyeDropper();
        if (!hex) return;
        if (currentMenu.value === 'color') {
            textColor.value = hex;
        } else if (currentMenu.value === 'outline') {
            outlineColor.value = hex;
        }
        backPage();
    }

    function applyText() {
        const payload = selectedText.value
            ? textContent.value                      // editing an existing text
            : (newTextEl.value?.value ?? '');        // first-time create → read raw input

        emit('uploadText', payload);
        if (!selectedText.value && newTextEl.value) newTextEl.value.value = ''; // optional clear
        currentMenu.value = 'menu';
    }

    function backPage() {
        if (currentMenu.value !== 'menu') currentMenu.value = 'menu';
    }

    function togglePage(page: string) {
        if (currentMenu.value !== page) {
            currentMenu.value = page;
            searchQuery.value = '';
        }
    }

    // Expose backPage to parent
    defineExpose({ backPage });
</script>

<style scoped lang="scss">

    .font-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        max-width: 100%;

        input {
            display: flex;
            background: transparent;
            border: 3px solid rgb(107, 112, 120);
            border-radius: 8px;
            width: 100%;
            height: 2.25rem;
            text-align: center;
            font-family: 'Anek Latin';
            font-size: 100%;
            font-weight: 600;
            color: rgb(107, 112, 120);
            outline: none;
            margin: 0;

            box-sizing: border-box;
        }
    }

    #textStyles {
        display: flex;
        gap: 0.4rem;
        margin-left: auto;
        margin-right: 1rem;
        margin-bottom: 0.5rem;
        margin-top: 0.5rem;

        &.disabled {
            opacity: 0.4;
            pointer-events: none;
        }
    }

    .textStyleControl {
        width: 2rem;
        height: 2rem;
        border-radius: 6px;
        border: 1px solid rgb(107, 112, 120);
        background-color: transparent;
        color: rgb(107, 112, 120);
        font-size: 0.9rem;
        font-weight: 600;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        padding: 0;

        &.active {
            border-color: rgb(159, 199, 86);
            background-color: rgba(159, 199, 86, 0.12);
            color: rgb(64, 72, 50);
        }

        &:active {
            border: 1px solid rgb(159, 199, 86);
        }
    }


    #customize {
        display: flex;
        flex-direction: row;
        margin: 0.5rem 0rem;

        .customize-btn {
            background-color: transparent;
            color: rgb(107, 112, 120);
            font-size: 0.6rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
            justify-content: center;
            width: 6rem;
            text-align: left;
            position: relative;
            overflow: hidden;
            transition: transform 0.2s ease, background-color 0.5s ease;

            .icon {
                object-fit: contain;
                height: 2rem;
            }




            &:active {
                transform: scale(0.95);
                animation: bounce 1s ease;
            }
        }
    }

    #apply {
        background-color: rgb(168, 203, 104);
        font-family: 'Anek Latin';
        font-weight: 600;
        padding: 0.5rem 1rem;
        margin: 1rem auto;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        position: relative;
        overflow: hidden;
        transition: transform 0.2s ease;
        transition: 0.5s;

        &:hover::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 200%;
            height: 100%;
            background: linear-gradient(135deg, transparent 0%, rgba(255, 255, 255, 0.2) 50%, transparent 100%);
            transform: skewX(-20deg);
            animation: slowShine 2s ease-in-out infinite;
            opacity: 0;
            transition: opacity 0.5s ease;
        }

        &:hover {
            transition: 0.5s ease;
            background-color: rgb(180, 220, 120);
        }



        &:active {
            transform: scale(0.95);
            animation: bounce 1s ease;
        }
    }


    @keyframes slowShine {
        0% {
            left: -100%;
            opacity: 0;
        }

        30% {
            opacity: 1;
        }

        70% {
            opacity: 1;
        }

        100% {
            left: 100%;
            opacity: 0;
        }
    }

    @keyframes bounce {
        0% {
            transform: scale(0.95);
        }

        50% {
            transform: scale(1.05);
        }

        100% {
            transform: scale(1);
        }
    }

    hr {
        width: 100%;
        height: 2px;
        background-color: rgba(195, 195, 195, 0.724);
        border: none;
        margin: 0;
    }


    .font-list {
        .search-bar {
            position: relative;
            width: 100%;
            max-width: 100%;

        }

        .search-bar input {
            width: 100%;
            padding: 0.4rem 2rem 0.4rem 0.8rem;
            background-color: white;
            border: 1px solid #a0a6ac;
            border-radius: 7px;
            font-size: 0.9rem;
            font-family: "Anek Latin";
            color: #4d555d;
            outline: none;
            box-sizing: border-box;

            &:focus {
                border-color: #7d858c;
                box-shadow: 0 0 0 2px rgba(125, 133, 140, 0.2);
            }
        }

        .search-icon {
            position: absolute;
            right: 0.6rem;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.9rem;
            color: #6d757d;
            pointer-events: none;
        }

        #allFontButton {
            background-color: transparent;
            color: rgb(159, 199, 86);
            padding: 0.25rem 0rem;
            border: hidden;
        }



        .showcase {
            display: grid;
            margin-top: 1rem;
            grid-template-columns: 48% 48%;
            max-height: 50vh;
            row-gap: 1rem;
            overflow: scroll;
            z-index: 1;
            justify-content: space-between;
            scrollbar-width: 0px;

            .option {
                span {
                    text-align: center;
                    justify-content: center;
                    align-self: center;
                    color: #fff;

                }

                display: flex;
                border-radius: 7.5px;
                width: 100%;
                height: 6.5rem;
                margin: 0 auto;
                background-color: rgb(159, 199, 86);
                justify-content: center;
                border: hidden;
            }

        }

        .bottom {
            display: flex;
            flex-direction: row;
            width: 100%;
        }

        .font-search-results {
            max-height: 30rem;
            overflow-y: auto;
            scrollbar-width: none;
            /* Firefox */
            -ms-overflow-style: none;
            /* IE/Edge */
        }

        .font-search-results::-webkit-scrollbar {
            display: none;
            /* Chrome/Safari */
        }
    }

    .font-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 0.5rem;
        border-bottom: 2px solid #cecececf;
        cursor: pointer;

    }

    .color-list {
        .low-contrast-toggle {
            display: flex;
            align-items: center;

            gap: 0.5rem;
            margin-left: -2.375rem;
            background-color: #fff;
            color: rgb(64, 72, 50);
            border-radius: 8px;
            padding: 0.5rem 0.75rem;
            cursor: pointer;

            font-size: 0.75rem;

            .label-text {
                display: inline-flex;
                align-items: center;
                gap: 0.25rem;
                position: relative;
            }

            .color-word {
                position: relative;
                display: inline-block;
                padding-right: 0.6rem; // space for the hit bubble
            }

            .hit-bubble {
                position: absolute;
                top: -0.25rem;
                right: -0.1rem;
                width: 0.45rem;
                height: 0.45rem;
                border-radius: 999px;
                font-size: 0.5rem;
                line-height: 0.5rem;
                outline: 1px solid rgba(0, 0, 0, 0.5);
                color: rgba(0, 0, 0, 0.5);
                cursor: help;
                font-family: 'Courier New', Courier, monospace;
            }

            .tooltip {
                position: absolute;
                left: 50%;
                display: flex;
                width: 10rem;
                flex-wrap: wrap;
                height: auto;

                transform: translateX(-50%) translateY(0.25rem);
                bottom: -550%; // sits under the word
                background: #fff;
                color: #404832;
                border: 1px solid rgba(0, 0, 0, 0.12);
                border-radius: 6px;
                padding: 0.25rem 0.4rem;
                font-size: 0.65rem;
                line-height: 1;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.15s ease,
                    transform 0.15s ease;


            }

            /* show tooltip when hovering the tiny bubble */
            .color-word .hit-bubble:hover+.tooltip,
            .color-word:hover .tooltip {
                opacity: 1;
                transform: translateX(-50%) translateY(0.4rem);

            }

            input {
                appearance: none;
                -webkit-appearance: none;
                width: 1.1rem;
                height: 1.1rem;
                border-radius: 5px;
                border: 1px dotted rgb(176, 176, 176);
                background-color: #fff; // unchecked is white
                cursor: pointer;
                display: inline-block;
                position: relative;
                overflow: hidden;
                margin-right: -0.25rem;
                transition: border-color 0.2s ease, box-shadow 0.2s ease;

                &:focus {
                    outline: none;
                    box-shadow: 0 0 0 3px rgba(159, 199, 86, 0.25);
                }

                // checked state: white box with green checkmark SVG
                &:checked {
                    background-color: #fff;
                    background-repeat: no-repeat;
                    background-position: center;
                    background-size: 90% 90%;
                    border-color: rgb(159 199 86);
                    background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%239FC756' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><path d='M5 13l4 4L19 7'/></svg>");
                }
            }
        }

        .colorPicker {

            font-size: 0.75rem;
            display: flex;
            color: rgb(159, 199, 86);
            align-items: center;
            cursor: pointer;

            &:hover {
                transition: 0.5s ease;

            }



            &:active {
                transform: scale(0.95);
                animation: bounce 1s ease;
            }

            svg {
                object-fit: contain;
                height: 2rem;
                width: 1.5rem;
                height: 1.5rem;
            }
        }

        .swatches {
            display: flex;
            gap: 0.3rem;
            margin-left: -1.5rem;
            flex-wrap: wrap;


        }

        span {
            font-family: 'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif;
            font-weight: 100;

        }

        .outline {
            display: flex;
            border: 2px solid rgb(164 199 77);
            background-color: #fff;
            color: rgb(164 199 77);
            border-radius: 8px;
            padding: 0.5rem 0.5rem;
            width: 7rem;
            justify-content: center;
            cursor: pointer;
        }

        .submit {
            display: flex;
            background-color: rgb(164 199 77);
            border-radius: 8px;
            padding: 0.5rem 2.25rem;
            color: white;
            width: 1rem;
            justify-content: center;
            cursor: pointer;
            font-size: 1.1rem;
            margin-left: 1rem;



            &:hover {
                transition: 0.5s ease;
                background-color: rgb(180, 220, 120);
            }



            &:active {
                transform: scale(0.95);
                animation: bounce 1s ease;
            }
        }

    }

    .effect-list {
        .effect-swatches {
            display: grid;
            grid-template-columns: 100px 100px 100px;


            .effect-swatch {

                box-sizing: border-box;
                width: 10rem;
                height: 5rem;
                border: 1px solid #a6a9ac2e;
                align-content: center;
                cursor: pointer;

                span {
                    font-weight: 200;
                }

                &.active {
                    border: 2px solid rgb(159, 199, 86);
                }

                &:active {
                    background-color: #c2c2c229;
                }
            }
        }
    }

    .color-swatch {
        width: 1.35rem;
        height: 1.35rem;
        border-radius: 5px;
        cursor: pointer;
        position: relative;
        overflow: hidden;

        svg {
            object-fit: contain;
            height: 100%;
        }
    }

    svg {
        object-fit: contain;
        height: 1rem;
    }

    .columnContainer {
        display: flex;
        flex-direction: row;


        .leftColumn {
            display: flex;
            gap: 0.5rem;
            min-width: 10rem;


        }

    }

    .bottom {
        display: flex;
        flex-direction: row;
        width: 100%;
        margin-top: 1rem;
    }
</style>
