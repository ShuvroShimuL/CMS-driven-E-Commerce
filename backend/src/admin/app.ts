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
          primary500: '#f5f5f5',
          primary600: '#ffffff',
          primary700: '#ffffff',
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
          buttonPrimary500: '#f5f5f5',
          buttonPrimary600: '#ffffff',
        },
      },
      light: {
        colors: {
          primary100: '#f0f0f0',
          primary200: '#e0e0e0',
          primary500: '#0a0a0a',
          primary600: '#000000',
          primary700: '#000000',
          buttonPrimary500: '#0a0a0a',
          buttonPrimary600: '#111111',
        },
      },
    },
  },
  bootstrap() {},
};
