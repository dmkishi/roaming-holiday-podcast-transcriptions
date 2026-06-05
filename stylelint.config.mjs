/**
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard'],
  rules: {
    'custom-property-empty-line-before': ['always', {
      except: [
        'first-nested',
      ],
      ignore: [
        'after-custom-property',
      ],
    }],
    // eslint-disable-next-line unicorn/no-null -- stylelint requires `null` to disable an inherited rule
    'selector-class-pattern': null,
  },
};
