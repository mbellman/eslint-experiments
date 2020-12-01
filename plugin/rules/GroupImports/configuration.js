module.exports = {
  groups: [
    [
      'react',
      'prop-types',
      'react-*',
      'redux',
      'reselect',
      'lodash'
    ], [
      'sr-*',
      'tdr-*'
    ], [
      'components/**/*'
    ], [
      'modules/!(utilities)'
    ], [
      'modules/**/selectors'
    ], [
      'modules/**/sagas'
    ], [
      'modules/utilities'
    ]
  ]
};
