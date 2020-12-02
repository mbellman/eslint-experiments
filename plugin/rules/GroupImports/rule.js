// @ts-check

const micromatch = require('micromatch');
const { groups } = require('./configuration');

/**
 * @typedef ASTNode
 * @property {string} type
 */

/**
 * @typedef ImportNode
 * @property {string} type
 * @property {number} start
 * @property {number} end
 * @property {ImportSpecifier[]} specifiers
 * @property {object} source
 * @property {string} source.value
 */

/**
 * @typedef ImportSpecifier
 * @property {string} type
 * @property {number} start
 * @property {number} end
 * @property {object} imported
 * @property {string} imported.name
 * @property {object} local
 * @property {string} local.name
 */

/**
 * @typedef SingleImport
 * @property {string} name
 * @property {string} alias
 */

/**
 * @typedef ImportWeight
 * @property {number} group
 * @property {number} pattern
 * @property {number} type
 * @property {string} name
 */

/**
 * @typedef ImportRecord
 * @property {string} defaultImport
 * @property {string} namespaceImport
 * @property {SingleImport[]} singleImports
 * @property {string} path
 * @property {ImportWeight} weight
 * @property {ImportNode} node
 */

/**
 * @type {number}
 */
const LINE_BREAK_LENGTH = process.platform === 'win32' ? 2 : 1;

/**
 * @param {ASTNode} node
 *
 * @returns {boolean}
 */
const isImportNode = ({ type }) => type === 'ImportDeclaration';

/**
 * @param {ImportSpecifier} specifier
 *
 * @returns {boolean}
 */
const isDefaultImportSpecifier = ({ type }) => type === 'ImportDefaultSpecifier';

/**
 * @param {ImportSpecifier} specifier
 *
 * @returns {boolean}
 */
const isNamespaceImportSpecifier = ({ type }) => type === 'ImportNamespaceSpecifier';

/**
 * @param {ImportSpecifier} specifier
 *
 * @returns {boolean}
 */
const isSingleImportSpecifier = ({ type }) => type === 'ImportSpecifier';

/**
 * @param {ImportSpecifier} specifier
 *
 * @returns {string}
 */
const getImportSpecifierName = ({ local: { name } }) => name;

/**
 * @example
 *
 *   { name: 'actions', alias: 'exampleActions' }
 *     => "actions as exampleActions"
 *
 *   { name: 'actions', alias: 'actions' }
 *     => "actions"
 *
 * @param {SingleImport} singleImport
 *
 * @returns {string}
 */
function getSingleImportAsCodeString(singleImport) {
  if (singleImport.name === singleImport.alias) {
    return singleImport.name;
  } else {
    return `${singleImport.name} as ${singleImport.alias}`;
  }
}

/**
 * @example
 *
 *   { defaultImport: 'React', path: 'react' }
 *     => "import React from 'react';"
 *
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getDefaultImportRecordAsCodeString({ defaultImport, path }) {
  return `import ${defaultImport} from '${path}';`;
}

/**
 * @example
 *
 *   {
 *     defaultImport: 'React',
 *     singleImports: [
 *       { name: 'Component', alias: 'Component' },
 *       { name: 'createRef', alias: 'createRef' }
 *     ],
 *     path: 'react'
 *   }
 *     => "import React, { Component, createRef } from 'react';"
 *
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getDefaultAndSingleImportRecordAsCodeString({ defaultImport, singleImports, path }) {
  const singleImportStrings = singleImports.map(getSingleImportAsCodeString);

  return `import ${defaultImport}, { ${singleImportStrings.join(',')} } from '${path}';`;
}

/**
 * @example
 *
 *   { defaultImport: 'Main', namespaceImport: 'utilities', path: 'library' }
 *     => "import Main, * as utilities from 'library';"
 *
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getDefaultAndNamespaceImportRecordAsCodeString({ defaultImport, namespaceImport, path }) {
  return `import ${defaultImport}, * as ${namespaceImport} from '${path}';`;
}

/**
 * @example
 *
 *   { namespaceImport: 'utilities', path: 'utility-belt' },
 *     => "import * as utilities from 'utility-belt';"
 *
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getNamespaceImportRecordAsCodeString({ namespaceImport, path }) {
  return `import * as ${namespaceImport} from '${path}';`;
}

/**
 * @example
 *
 *   {
 *     singleImports: [
 *       { name: 'useEffect', alias: 'useEffect' },
 *       { name: 'useState', alias: 'useState' },
 *       { name: 'useRef', alias: 'useRef' }
 *     ],
 *     path: 'react'
 *   }
 *     => "import { useEffect, useState, useRef } from 'react';"
 *
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getSingleImportRecordAsCodeString({ singleImports, path }) {
  const singleImportStrings = singleImports.map(getSingleImportAsCodeString);

  return `import { ${singleImportStrings.join(', ')} } from '${path}';`;
}

/**
 * @param {ImportRecord} importRecord
 *
 * @returns {string}
 */
function getImportRecordAsCodeString(importRecord) {
  const { defaultImport, namespaceImport, singleImports } = importRecord;
  const hasSingleImports = singleImports.length > 0;

  if (defaultImport && !namespaceImport && !hasSingleImports) {
    return getDefaultImportRecordAsCodeString(importRecord);
  } else if (defaultImport && namespaceImport) {
    return getDefaultAndNamespaceImportRecordAsCodeString(importRecord);
  } else if (defaultImport && hasSingleImports) {
    return getDefaultAndSingleImportRecordAsCodeString(importRecord);
  } else if (namespaceImport) {
    return getNamespaceImportRecordAsCodeString(importRecord);
  } else if (hasSingleImports) {
    return getSingleImportRecordAsCodeString(importRecord);
  } else {
    return '';
  }
}

/**
 * @param {string} defaultImport
 * @param {string} namespaceImport
 * @param {SingleImport[]} singleImports
 * @param {string} path
 *
 * @returns {ImportWeight}
 */
function getImportWeight(defaultImport, namespaceImport, singleImports, path) {
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];

    for (let j = 0; j < group.length; j++) {
      const pattern = group[j];

      if (micromatch.isMatch(path, pattern)) {
        const typeWeight =
          defaultImport ? 0 :
          namespaceImport ? 1 :
          2;

        return {
          group: i,
          pattern: j,
          type: typeWeight,
          name: defaultImport || namespaceImport || singleImports[0].alias
        };
      }
    }
  }

  return {
    group: 0,
    pattern: 0,
    type: 0,
    name: ''
  };
}

/**
 * @param {ImportWeight} importWeight
 *
 * @returns {number}
 */
function getNumericImportWeight({ group, pattern, type }) {
  return 1e6 * group + 1e3 * pattern + type;
}

/**
 * @param {ImportNode} importNode
 *
 * @returns {ImportRecord}
 */
function createImportRecord(importNode) {
  const { specifiers } = importNode;
  const defaultImport = specifiers.filter(isDefaultImportSpecifier).map(getImportSpecifierName).pop();
  const namespaceImport = specifiers.filter(isNamespaceImportSpecifier).map(getImportSpecifierName).pop();

  const singleImports = specifiers.filter(isSingleImportSpecifier).map(specifier => ({
    name: specifier.imported.name,
    alias: specifier.local.name
  }));

  const path = importNode.source.value;
  const weight = getImportWeight(defaultImport, namespaceImport, singleImports, path);

  return {
    defaultImport,
    namespaceImport,
    singleImports,
    path,
    weight,
    node: importNode
  };
}

/**
 * @param {ImportWeight} weightA
 * @param {ImportWeight} weightB
 *
 * @returns {boolean}
 */
function areImportWeightsSequential(weightA, weightB) {
  const numericWeightA = getNumericImportWeight(weightA);
  const numericWeightB = getNumericImportWeight(weightB);

  if (numericWeightA < numericWeightB) {
    return true;
  } else if (numericWeightA === numericWeightB) {
    return weightA.name < weightB.name;
  } else {
    return false;
  }
}

/**
 * @param {ImportWeight} weightA
 * @param {ImportWeight} weightB
 *
 * @returns {boolean}
 */
function areImportWeightsEqual(weightA, weightB) {
  return (
    weightA.group === weightB.group &&
    weightA.pattern === weightB.pattern &&
    weightA.type === weightB.type &&
    weightA.name === weightB.name
  );
}

/**
 * @param {ImportRecord[]} importRecords
 *
 * @returns {boolean}
 */
function areImportRecordsCorrectlyGrouped(importRecords) {
  for (let i = 0; i < importRecords.length - 1; i++) {
    const currentImportRecord = importRecords[i];
    const nextImportRecord = importRecords[i + 1];

    if (!areImportWeightsSequential(currentImportRecord.weight, nextImportRecord.weight)) {
      return false;
    }

    if (
      currentImportRecord.weight.group < nextImportRecord.weight.group &&
      nextImportRecord.node.start - currentImportRecord.node.end < LINE_BREAK_LENGTH * 2
    ) {
      return false;
    }
  }

  return true;
}

/**
 * @param {ImportRecord[]} importRecords
 *
 * @returns {string}
 */
function getFixedImportRecords(importRecords) {
  const sortedImportRecords = importRecords
    .sort((recordA, recordB) => {
      const { weight: weightA } = recordA;
      const { weight: weightB } = recordB;

      if (areImportWeightsEqual(weightA, weightB)) {
        return 0;
      }

      return areImportWeightsSequential(weightA, weightB) ? -1 : 1;
    });

  return sortedImportRecords
    .map((importRecord, index) => {
      const codeString = getImportRecordAsCodeString(importRecord);
      const nextImportRecord = sortedImportRecords[index + 1];

      if (
        !nextImportRecord ||
        nextImportRecord.weight.group === importRecord.weight.group
      ) {
        return codeString;
      } else {
        return `${codeString}\n`;
      }
    })
    .join('\n');
}

/**
 * @param {object} context 
 * @param {ASTNode} programNode
 * @param {[ number, number ]} range 
 * @param {ImportRecord[]} importRecords 
 */
function reportUngroupedImports(context, programNode, [ start, end ], importRecords) {
  const sourceCode = context.getSourceCode();

  context.report({
    node: programNode,
    loc: {
      start: sourceCode.getLocFromIndex(start),
      end: sourceCode.getLocFromIndex(end)
    },
    message: 'Imports are in the wrong order',
    fix(fixer) {
      return fixer.replaceTextRange(
        [start, end],
        getFixedImportRecords(importRecords)
      );
    }
  })
}

module.exports = {
  meta: {
    type: 'suggestion',
    fixable: 'code'
  },
  create(context) {
    return {
      Program(programNode) {
        const importNodes = programNode.body.filter(isImportNode);

        if (!importNodes.length) {
          return;
        }

        const importRecords = importNodes.map(createImportRecord);

        if (!areImportRecordsCorrectlyGrouped(importRecords)) {
          /**
           * @type {[ number, number ]}
           */
          const lintingErrorRange = [
            importNodes[0].start,
            importNodes[importNodes.length - 1].end
          ];

          reportUngroupedImports(context, programNode, lintingErrorRange, importRecords);
        }
      }
    };
  }
}