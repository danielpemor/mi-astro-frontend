// src/lib/directus.ts
import { createDirectus, rest, readItems, readItem } from '@directus/sdk';

// Interfaces para tus colecciones
export interface MenuCategory {
  id: number;
  name: string;
  order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  description: string;
  price: number;
  image?: string;
  category?: { id: number; name: string };
  is_available: boolean;
  dietary_tags?: string[];
}

export interface HeroSection {
  id: number;
  title: string;
  subtitle?: string;
  background_image?: string;
  cta_text?: string;
  cta_link?: string;
}

export interface GalleryImage {
  id: number;
  image: string;
  alt_text?: string;
}

export interface AboutUs {
  id: number;
  title: string;
  content: string;
  image?: string;
}

export interface OpeningHour {
  id: number;
  day_of_week: string;
  open_time: string;
  close_time: string;
  is_closed?: boolean;
}

export interface SiteSettings {
  id: number;
  logo?: string;
  favicon?: string;
  primary_color?: string;
  secondary_color?: string;
}

export interface SocialLink {
  id: number;
  type: string;
  url: string;
  icon?: string;
}

export interface Testimonial {
  id: number;
  name: string;
  review: string;
  rating: number;
  photo?: string;
}

export interface ContactInfo {
  id: number;
  phone?: string;
  email?: string;
  address?: string;
  map_embed_url?: string;
}

export interface PhilosophyItem {
  id: number;
  title: string;
  description: string;
  image?: string;
  order: number;
}

// URL de la API de Directus - CORREGIDA
const directusUrl = import.meta.env.PUBLIC_DIRECTUS_URL || import.meta.env.DIRECTUS_URL || 'http://localhost:8055';

// Cliente de Directus
const directus = createDirectus(directusUrl).with(rest());

// FUNCIÓN PRINCIPAL PARA ASSETS - COMPLETAMENTE CORREGIDA
export function getAssetUrl(
  assetId: string | null | undefined,
  params?: {
    width?: number;
    height?: number;
    quality?: number;
    fit?: 'cover' | 'contain' | 'inside' | 'outside';
  }
): string {
  if (!assetId) return '/placeholder-food.jpg';

  const base =
    import.meta.env.PUBLIC_DIRECTUS_URL ||             // ➜ '/api' en Netlify
    import.meta.env.DIRECTUS_URL ||
    'http://localhost:8055';

  const url = new URL(`${base.replace(/\/$/, '')}/assets/${assetId}`);

  if (params?.width)   url.searchParams.set('width',   String(params.width));
  if (params?.height)  url.searchParams.set('height',  String(params.height));
  if (params?.quality) url.searchParams.set('quality', String(params.quality));
  if (params?.fit)     url.searchParams.set('fit',     params.fit);

  return url.toString();
}

// Función para obtener URL con transformaciones específicas
export function getOptimizedImageUrl(
  assetId: string | null | undefined,
  width?: number,
  height?: number,
  quality: number = 80
): string {
  return getAssetUrl(assetId, { width, height, quality, fit: 'cover' });
}

// Función para verificar si una imagen existe y es accesible
export async function verifyAssetUrl(assetId: string): Promise<{
  exists: boolean;
  url: string;
  error?: string;
}> {
  const url = getAssetUrl(assetId);
  
  try {
    const response = await fetch(url, { 
      method: 'HEAD',
      headers: {
        'Accept': 'image/*'
      }
    });
    
    return {
      exists: response.ok,
      url: url,
      error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
    };
  } catch (error) {
    return {
      exists: false,
      url: url,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Función de debug mejorada
export function debugAssetUrls(assetId: string): {
  attempted: string[];
  recommended: string;
} {
  if (!assetId) return { attempted: [], recommended: '/placeholder-food.jpg' };
  
  const baseUrl = directusUrl.replace(/\/$/, '');
  const cleanId = assetId.toString().replace(/^.*\//, '');
  
  const attempted = [
    `${baseUrl}/files/${cleanId}`,
    `${baseUrl}/assets/${cleanId}`,
    `${baseUrl}/uploads/${cleanId}`,
    `${baseUrl}/api/files/${cleanId}`,
  ];
  
  return {
    attempted,
    recommended: attempted[0] // /files/ es la correcta
  };
}

// Datos de ejemplo para fallback (mantengo los tuyos)
const mockData = {
  menuCategories: [
    { id: 1, name: 'Entradas', order: 1 },
    { id: 2, name: 'Platos Principales', order: 2 },
    { id: 3, name: 'Postres', order: 3 }
  ],
  menuItems: [
    { 
      id: 1, 
      name: 'Ensalada César', 
      description: 'Lechuga fresca, pollo a la parrilla, queso parmesano y aderezo César casero.', 
      price: 12.99,
      category: { id: 1, name: 'Entradas' },
      is_available: true,
      dietary_tags: ['Bajo en carbohidratos'] 
    },
    { 
      id: 2, 
      name: 'Pasta al Pesto', 
      description: 'Pasta fresca con albahaca, ajo, piñones, queso parmesano y aceite de oliva.', 
      price: 15.99,
      category: { id: 2, name: 'Platos Principales' },
      is_available: true,
      dietary_tags: ['Vegetariano'] 
    },
    { 
      id: 3, 
      name: 'Tiramisú', 
      description: 'Postre italiano clásico con capas de bizcocho empapado en café y crema de mascarpone.', 
      price: 8.99,
      category: { id: 3, name: 'Postres' },
      is_available: true
    }
  ],
  heroSection: {
    id: 1,
    title: 'Sabores auténticos para cada ocasión',
    subtitle: 'Disfruta de nuestra cocina con ingredientes frescos y locales',
    cta_text: 'Ver nuestro menú',
    cta_link: '/menu'
  },
  siteSettings: {
    id: 1,
    primary_color: '#3b8449',
    secondary_color: '#274d30'
  },
  aboutUs: {
    id: 1,
    title: 'Nuestra Historia',
    content: '<p>Desde nuestros inicios, hemos mantenido el compromiso de ofrecer platos elaborados con productos frescos y de temporada.</p><p>Trabajamos directamente con productores locales para garantizar la máxima calidad en cada ingrediente que utilizamos.</p>'
  },
  openingHours: [
    { id: 1, day_of_week: 'Lunes', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 2, day_of_week: 'Martes', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 3, day_of_week: 'Miércoles', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 4, day_of_week: 'Jueves', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 5, day_of_week: 'Viernes', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 6, day_of_week: 'Sábado', open_time: '10:00', close_time: '22:00', is_closed: false },
    { id: 7, day_of_week: 'Domingo', open_time: '10:00', close_time: '22:00', is_closed: false }
  ],
  contactInfo: {
    id: 1,
    phone: '+1 234 567 890',
    email: 'info@restaurante.com',
    address: 'Calle Ejemplo 123, Ciudad'
  },
  socialLinks: [
    { id: 1, type: 'Facebook', url: 'https://facebook.com' },
    { id: 2, type: 'Instagram', url: 'https://instagram.com' },
    { id: 3, type: 'Twitter', url: 'https://twitter.com' }
  ],
  testimonials: [
    {
      id: 1,
      name: 'María García',
      review: 'La comida es increíble. Los sabores son auténticos y el servicio es excelente.',
      rating: 5
    },
    {
      id: 2,
      name: 'Juan Pérez',
      review: 'Excelente ambiente y platos deliciosos. Volveré pronto.',
      rating: 4
    }
  ],
  galleryImages: [
    { id: 1, image: "gallery-1.jpg", alt_text: "Plato especial del chef" },
    { id: 2, image: "gallery-2.jpg", alt_text: "Interior del restaurante" },
    { id: 3, image: "gallery-3.jpg", alt_text: "Preparación de platos" },
    { id: 4, image: "gallery-4.jpg", alt_text: "Barra de bebidas" },
    { id: 5, image: "gallery-5.jpg", alt_text: "Terraza exterior" }
  ],
  philosophyItems: [
    {
      id: 1,
      title: "Ingredientes Frescos",
      description: "Seleccionamos los mejores ingredientes de temporada para ofrecerte platos llenos de sabor y frescura.",
      image: "",
      order: 1
    },
    {
      id: 2,
      title: "Sostenibilidad",
      description: "Nos comprometemos con el medio ambiente utilizando prácticas sostenibles y reduciendo nuestro impacto ecológico.",
      image: "",
      order: 2
    },
    {
      id: 3,
      title: "Comunidad Local",
      description: "Apoyamos a productores locales y participamos activamente en nuestra comunidad para fortalecer la economía local.",
      image: "",
      order: 3
    }
  ]
};

// Funciones para obtener datos con mejor manejo de errores
export async function getMenuCategories(): Promise<MenuCategory[]> {
  try {
    const response = await directus.request(readItems('menu_categories', {
      sort: ['order'],
      limit: -1
    }));
    return response as unknown as MenuCategory[];
  } catch (error) {
    console.error('Error fetching menu categories:', error);
    return mockData.menuCategories as MenuCategory[];
  }
}

export async function getMenuItems(categoryId: number | null = null): Promise<MenuItem[]> {
  try {
    const query: any = {
      fields: ['*', { category: ['id', 'name'] }],
      limit: -1
    };
    
    if (categoryId) {
      query.filter = { category: { id: { _eq: categoryId } } };
    }
    
    const response = await directus.request(readItems('menu_items', query));
    return response as unknown as MenuItem[];
  } catch (error) {
    console.error('Error fetching menu items:', error);
    return mockData.menuItems as MenuItem[];
  }
}

export async function getHeroSection(): Promise<HeroSection | null> {
  try {
    const response = await directus.request(readItem('hero_section', 1));
    return response as unknown as HeroSection;
  } catch (error) {
    console.error('Error fetching hero section:', error);
    return mockData.heroSection as HeroSection;
  }
}

export async function getGalleryImages() {
  const resp = await directus.request(
    readItems('gallery_images', { fields: ['id', 'alt_text', { image: ['id'] }], limit: -1 })
  );
  return (resp as any[]).map((g) => ({
    ...g,
    image: typeof g.image === 'object' ? g.image?.id : g.image,
  }));
}
export async function getAboutUs(): Promise<AboutUs | null> {
  try {
    const response = await directus.request(readItem('about_us', 1));
    return response as unknown as AboutUs;
  } catch (error) {
    console.error('Error fetching about us:', error);
    return mockData.aboutUs as AboutUs;
  }
}

export async function getOpeningHours(): Promise<OpeningHour[]> {
  try {
    const response = await directus.request(readItems('opening_hours', {
      sort: ['day_of_week'],
      limit: -1
    }));
    return response as unknown as OpeningHour[];
  } catch (error) {
    console.error('Error fetching opening hours:', error);
    return mockData.openingHours as unknown as OpeningHour[];
  }
}

export async function getSiteSettings(): Promise<SiteSettings | null> {
  try {
    const response = await directus.request(readItem('site_settings', 1));
    return response as unknown as SiteSettings;
  } catch (error) {
    console.error('Error fetching site settings:', error);
    return mockData.siteSettings as SiteSettings;
  }
}

export async function getSocialLinks(): Promise<SocialLink[]> {
  try {
    const response = await directus.request(readItems('social_links', {
      limit: -1
    }));
    return response as unknown as SocialLink[];
  } catch (error) {
    console.error('Error fetching social links:', error);
    return mockData.socialLinks as unknown as SocialLink[];
  }
}

export async function getTestimonials(): Promise<Testimonial[]> {
  try {
    const response = await directus.request(readItems('testimonials', {
      limit: -1
    }));
    return response as unknown as Testimonial[];
  } catch (error) {
    console.error('Error fetching testimonials:', error);
    return mockData.testimonials as unknown as Testimonial[];
  }
}

export async function getContactInfo(): Promise<ContactInfo | null> {
  try {
    const response = await directus.request(readItem('contact_info', 1));
    return response as unknown as ContactInfo;
  } catch (error) {
    console.error('Error fetching contact info:', error);
    return mockData.contactInfo as unknown as ContactInfo;
  }
}

export async function getPhilosophyItems(): Promise<PhilosophyItem[]> {
  try {
    const response = await directus.request(readItems('philosophy_items', {
      sort: ['order'],
      limit: -1
    }));
    return response as unknown as PhilosophyItem[];
  } catch (error) {
    console.error('Error fetching philosophy items:', error);
    return mockData.philosophyItems as PhilosophyItem[];
  }
}