/* eslint-disable unicorn/no-null -- stylelint requires `null` to disable inherited rules */
import { propertyGroups } from 'stylelint-config-clean-order';

function propertiesOrder() {
  return propertyGroups.map((properties) => ({
    noEmptyLineBetween: true,
    emptyLineBefore: 'never', // Don't add empty lines between order groups.
    properties,
  }));
}

/**
 * @type {import('stylelint').Config}
 */
export default {
  extends: [
    'stylelint-config-standard',
    'stylelint-config-clean-order',
  ],
  rules: {
    'custom-property-empty-line-before': ['always', {
      except: [
        'first-nested',
      ],
      ignore: [
        'after-custom-property',
      ],
    }],
    'selector-class-pattern': null,

    /**
     * Override stylelint-config-clean-order's `order/order`: place `@media`
     * blocks right after the element's own declarations (instead of last, after
     * nested rules), so media overrides stay grouped with what they override.
     */
    'order/order': [
      [
        { type: 'at-rule', name: 'import' },
        { type: 'at-rule', name: 'forward' },
        { type: 'at-rule', name: 'use' },
        'dollar-variables',
        'at-variables',
        'custom-properties',
        { type: 'at-rule', name: 'custom-media' },
        { type: 'at-rule', name: 'function' },
        { type: 'at-rule', name: 'mixin' },
        { type: 'at-rule', name: 'extend' },
        'declarations',
        { type: 'at-rule', name: 'media', hasBlock: true },
        // eslint-disable-next-line require-unicode-regexp -- Match upstream config; the /v flag isn't supported everywhere yet.
        { type: 'rule', selector: /^&::[\w-]+/, hasBlock: true },
        'rules',
      ],
      {
        severity: 'warning',
      },
    ],

    /**
     * Disable the empty-line enforcement that stylelint-config-clean-order adds.
     */
    'declaration-empty-line-before': null,
    'at-rule-empty-line-before': null,
    'order/properties-order': [
      propertiesOrder(),
      {
        severity: 'warning',
        unspecified: 'bottomAlphabetical',
      },
    ],
  },
};
