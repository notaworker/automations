
export const SELECTORS = {
  // Login page
  login: {
    username: 'input[name="userName"]',
    password: 'input[name="password"]',
    submit: 'button[type="submit"]'
  },

  // Post-login guard (any element that only appears when logged in)
  navGuard: 'nav, .ant-layout-header, .top-nav',

  // Device list navigation
  deviceTab: 'a[href*="/device"], button:has-text("Device"), span:has-text("Device")',

  // Device table and search
  deviceTable: 'table',
  searchBySN: 'input[placeholder="Search SN"], input[placeholder*="SN"]',

  // Row settings (update to match the gear button inside the target device row)
  rowSettingsButton: (deviceSn) => `xpath=//tr[.//text()[contains(., "${deviceSn}")]]//button[contains(@class, "settings")]`,

  // Advanced Set tab/button
  advancedSetTab: 'button:has-text("Advanced Set"), span:has-text("Advanced Set"), a:has-text("Advanced Set")',

  // Advanced Set body (register/value/password fields)
  registerField: 'input[name="register"], input[placeholder*="Register"]',
  valueField: 'input[name="value"], input[placeholder*="Value"]',
  installerPasswordField: 'input[name="installerPassword"], input[placeholder*="Password"]',

  // Save / Confirm
  saveButton: 'button:has-text("Save"), button:has-text("Confirm"), .ant-btn-primary:has-text("Save")'
};
