export default {
  config: {
    // Replace Strapi logo text with store brand
    head: {
      favicon: '',
    },
    menu: {
      logo: '',
    },
    translations: {
      en: {
        'app.components.LeftMenu.navbrand.title': 'Premium Store',
        'app.components.LeftMenu.navbrand.workplace': 'CMS Dashboard',
        'Auth.form.welcome.title': 'Premium Store Admin',
        'Auth.form.welcome.subtitle': 'Manage your storefront content',
      },
    },
    // Dark editorial palette matching the storefront
    theme: {
      dark: {
        colors: {
          primary100: '#1a1a1a',
          primary200: '#2a2a2a',
          primary500: '#a78bfa',
          primary600: '#8b5cf6',
          primary700: '#7c3aed',
          danger500: '#f43f5e',
          danger600: '#e11d48',
          success500: '#22c55e',
          success600: '#16a34a',
          neutral0: '#0a0a0a',
          neutral100: '#111111',
          neutral150: '#1a1a1a',
          neutral200: '#222222',
          neutral300: '#333333',
          neutral400: '#555555',
          neutral500: '#777777',
          neutral600: '#999999',
          neutral700: '#bbbbbb',
          neutral800: '#dddddd',
          neutral900: '#f5f5f5',
          neutral1000: '#ffffff',
          buttonPrimary500: '#8b5cf6',
          buttonPrimary600: '#7c3aed',
          buttonNeutral0: '#ffffff',
        },
      },
      light: {
        colors: {
          primary100: '#f3f0ff',
          primary200: '#e9e0ff',
          primary500: '#8b5cf6',
          primary600: '#7c3aed',
          primary700: '#6d28d9',
          buttonPrimary500: '#7c3aed',
          buttonPrimary600: '#6d28d9',
          buttonNeutral0: '#ffffff',
        },
      },
    },
  },
  bootstrap() {},
};
