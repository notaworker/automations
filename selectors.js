
// selectors.js
// Resilient selectors for Growatt ShineServer / OSS pages.
// These aim to survive minor UI changes (text, Ant Design components, etc.)

export const SELECTORS = {
  /**
   * Post-login guard (header/nav should exist on authenticated pages).
   * Used right after login to assert we're in the main app shell.
   */
  navGuard: 'nav, .ant-layout-header, .top-nav',

  /**
   * Devices tab (flexible across different labels/areas).
   * We use Playwright's text engine so page.click() can target it directly.
   */
  deviceTab: 'text=/Devices|Device List|My Devices|Plant Devices/i',

  /**
   * Device table root (Ant Design table or standard table).
   * Waiting for this ensures the grid is rendered.
   */
  deviceTable: '.ant-table, table',

  /**
   * Search input for Serial Number (SN).
   * Covers common placeholder/name variants.
   */
  searchBySN: 'input[placeholder*="SN"], input[placeholder*="Serial"], input[name*="sn"], input#sn',

  /**
   * Row "Settings" / gear button for a given device SN.
   * If SN is provided, we look for the row containing that text and then a settings control
   * (gear icon, "Settings" button, or similar).
   * If SN is empty, we fall back to the first row.
   *
   * NOTE: Playwright supports :has-text("...") and :has(...) in its selector engine.
   * If your tenant uses different action labels, feel free to add more alternatives below.
   */
  rowSettingsButton: (sn = '') => {
    if (sn && sn.trim().length > 0) {
      const safe = sn.replace(/["\\]/g, ''); // sanitize quotes/backslashes
      return [
        // Gear icon within the SN row
        `tr:has-text("${safe}") .anticon-setting`,
        `tr:has-text("${safe}") button:has(.anticon-setting)`,
        // Settings text/button variants
        `tr:has-text("${safe}") button:has-text("Settings")`,
        `tr:has-text("${safe}") .ant-btn:has-text("Settings")`,
        `tr:has-text("${safe}") a:has-text("Settings")`,
        // Generic action/ellipsis dropdown (sometimes used)
        `tr:has-text("${safe}") .ant-dropdown-trigger`,
        `tr:has-text("${safe}") .ant-btn:has(.anticon-more)`,
      ].join(', ');
    }
    // Fallback: first row's typical settings controls
    return [
      'tbody tr:first-child .anticon-setting',
      'tbody tr:first-child button:has(.anticon-setting)',
      'tbody tr:first-child button:has-text("Settings")',
      'tbody tr:first-child .ant-btn:has-text("Settings")',
      'tbody tr:first-child .ant-dropdown-trigger',
      'tbody tr:first-child .ant-btn:has(.anticon-more)',
    ].join(', ');
  },

  /**
   * "Advanced Set" tab or button.
   * Some tenants name it slightly differently; include common variants.
   */
  advancedSetTab: 'text=/Advanced Set|Advanced|Installer Settings|Advanced Settings/i',

  /**
   * Register and Value fields in the Advanced Set form.
   * Targets placeholders and common name/id attributes.
   */
  registerField: 'input[placeholder*="Register"], input[name*="register"], input#register',
  valueField:    'input[placeholder*="Value"], input[name*="value"], input#value',

  /**
   * Optional installer password field shown on some operations.
   * Uses a scoped password selector that should be unique in the Advanced Set pane.
   */
  installerPasswordField: [
    // Specific placeholder hint
    'section:has-text("Advanced") input[placeholder*="password"]',
    'form:has-text("Advanced") input[placeholder*="password"]',
    // Generic password field in the panel
    'section:has-text("Advanced") input[type="password"]',
    'form:has-text("Advanced") input[type="password"]',
    // Fallback: any visible password field
    'input[type="password"]'
  ].join(', '),

  /**
   * Save button for Advanced Set.
   * Includes common button patterns: primary Ant Design, icon-based, or plain text.
   */
  saveButton: [
    'button:has-text("Save")',
    '.ant-btn-primary:has-text("Save")',
    'button:has(.anticon-save)',
    // Sometimes it's labeled "Confirm" or "Apply"
    'button:has-text("Confirm")',
    'button:has-text("Apply")'
  ].join(', ')
};
