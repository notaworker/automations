
// selectors.js
export const SELECTORS = {
  // Post-login guard — broadened to catch common shells
  navGuard: 'nav, .ant-layout-header, .top-nav, .ant-layout, #root, #app',

  // Devices tab — include common variants
  deviceTab: 'text=/Devices|Device List|My Devices|Plant Devices/i',

  // Device table
  deviceTable: '.ant-table, table',

  // Search input for Serial Number (SN)
  searchBySN: 'input[placeholder*="SN"], input[placeholder*="Serial"], input[name*="sn"], input#sn',

  // Row "Settings" / gear button for a given device SN
  rowSettingsButton: (sn = '') => {
    if (sn && sn.trim().length > 0) {
      const safe = sn.replace(/["\\]/g, '');
      return [
        `tr:has-text("${safe}") .anticon-setting`,
        `tr:has-text("${safe}") button:has(.anticon-setting)`,
        `tr:has-text("${safe}") button:has-text("Settings")`,
        `tr:has-text("${safe}") .ant-btn:has-text("Settings")`,
        `tr:has-text("${safe}") a:has-text("Settings")`,
        `tr:has-text("${safe}") .ant-dropdown-trigger`,
        `tr:has-text("${safe}") .ant-btn:has(.anticon-more)`,
      ].join(', ');
    }
    return [
      'tbody tr:first-child .anticon-setting',
      'tbody tr:first-child button:has(.anticon-setting)',
      'tbody tr:first-child button:has-text("Settings")',
      'tbody tr:first-child .ant-btn:has-text("Settings")',
      'tbody tr:first-child .ant-dropdown-trigger',
      'tbody tr:first-child .ant-btn:has(.anticon-more)',
    ].join(', ');
  },

  // "Advanced Set" tab/button
  advancedSetTab: 'text=/Advanced Set|Advanced|Installer Settings|Advanced Settings/i',

  // Register & value fields
  registerField: 'input[placeholder*="Register"], input[name*="register"], input#register',
  valueField:    'input[placeholder*="Value"], input[name*="value"], input#value',

  // Optional installer password field
  installerPasswordField: [
    'section:has-text("Advanced") input[placeholder*="password"]',
    'form:has-text("Advanced") input[placeholder*="password"]',
    'section:has-text("Advanced") input[type="password"]',
    'form:has-text("Advanced") input[type="password"]',
    'input[type="password"]'
  ].join(', '),

  // Save button
  saveButton: [
    'button:has-text("Save")',
    '.ant-btn-primary:has-text("Save")',
    'button:has(.anticon-save)',
    'button:has-text("Confirm")',
    'button:has-text("Apply")'
  ].join(', ')
};
