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
        'app.components.LeftMenu.navbrand.workplace': 'Store management',
        'Auth.form.welcome.title': 'Premium Store Admin',
        'Auth.form.welcome.subtitle': 'Manage products, orders, and storefront content in one place.',
      },
    },
    // Dark editorial palette matching the storefront
    theme: {
      dark: {
        colors: {
          primary100: '#29213d',
          primary200: '#3b2d59',
          primary500: '#a78bfa',
          primary600: '#a78bfa',
          primary700: '#c4b5fd',
          danger500: '#f43f5e',
          danger600: '#e11d48',
          success500: '#22c55e',
          success600: '#16a34a',
          neutral0: '#0a0a0a',
          neutral100: '#111111',
          neutral150: '#1a1a1a',
          neutral200: '#222222',
          neutral300: '#333333',
          neutral400: '#737373',
          neutral500: '#a3a3a3',
          neutral600: '#b8b8b8',
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
