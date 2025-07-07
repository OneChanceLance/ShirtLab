export interface ClothingOption {
  name: string; // e.g. 'tshirt_f_l'
  displayName: string; // 'T-Shirt Female Large'
  type: string; // 'tshirt'
  size: string; // 'large'
  gender: string; // 'female'
  brand: string;
  material: string;
  image: string;
  grid: { x: number; y: number; w: number; h: number };
}

export interface ClothingStyleConfig {
  type: string;
  displayName: string;
  sizes: string[];
  genders: string[];
  brands: string[];
  materials: string[];
  imageBase: string;
  gridByGender: Record<string, { x: number; y: number; w: number; h: number }>;
  imagesByBrand?: Record<string, string>;
}

// List all style configs
export const CLOTHING_STYLES: ClothingStyleConfig[] = [
  {
    type: "tshirt",
    displayName: "T-Shirt",
    sizes: ["xs", "m", "l", "xl"],
    genders: ["male", "female", "unisex"],
    brands: ["Hanes", "Gildan", "Bella+Canvas"],
    materials: ["Cotton", "Polyester", "Blend"],
    imageBase: "/tshirt.jpg", // Example: /images/tshirt_m_l.png
    gridByGender: {
      male: { x: 140, y: 230, w: 280, h: 400 },
      female: { x: 120, y: 220, w: 360, h: 380 },
      unisex: { x: 110, y: 210, w: 380, h: 390 }
    },
    imagesByBrand: {
      "Hanes": "/hanes.png",
      "Gildan": "/gildan.png"
    }
  },
  {
    type: "shirt",
    displayName: "Shirt",
    sizes: ["s", "m", "xl", "xxl"],
    genders: ["male", "female"],
    brands: ["Hanes", "Fruit of the Loom", "American Apparel"],
    materials: ["Cotton", "Linen", "Blend"],
    imageBase: "/tshirt.jpg",
    gridByGender: {
      male: { x: 100, y: 200, w: 400, h: 400 },
      female: { x: 120, y: 220, w: 360, h: 380 },
      unisex: { x: 110, y: 210, w: 380, h: 390 }
    }
  },
  {
    type: "pants",
    displayName: "Pants",
    sizes: ["s", "m", "l", "xl", "xxl"],
    genders: ["male", "female"],
    brands: ["Levi's", "Wrangler", "Lee"],
    materials: ["Denim", "Cotton", "Polyester"],
    imageBase: "/pants.jpg",
    gridByGender: {
      male: { x: 100, y: 200, w: 400, h: 400 },
      female: { x: 120, y: 220, w: 360, h: 380 },
      unisex: { x: 110, y: 210, w: 380, h: 390 }
    }
  },
];

// Helper function to capitalize words
function capitalize(word: string) {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// Dynamically generate all clothing template options for the grid (unique per style, gender, brand)
export const CLOTHING_TEMPLATES: ClothingOption[] = CLOTHING_STYLES.flatMap(style =>
  style.genders.flatMap(gender =>
    style.brands.map(brand => {
      const genderInitial = gender[0].toLowerCase(); // e.g. m, f, u
      const name = `${style.type}_${genderInitial}_${brand.toLowerCase()}`;
      const displayName = `${capitalize(brand)}`;
      // Prefer style.imagesByBrand if available, otherwise style.imageBase
      let image = style.imageBase;
      if (style.imagesByBrand && style.imagesByBrand[brand]) {
        image = style.imagesByBrand[brand];
      } else if (
        (style.type === "shirt" || style.type === "pants") &&
        style.imagesByBrand && style.imagesByBrand[brand]
      ) {
        image = style.imagesByBrand[brand];
      }
      return {
        name,
        displayName,
        type: style.type,
        size: "", // not shown in the grid
        gender,
        brand,
        material: "", // not shown in the grid
        image: image,
        grid: style.gridByGender[gender] || style.gridByGender['unisex']
      };
    })
  )
);
