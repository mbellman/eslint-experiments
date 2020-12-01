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
 * @typedef ImportRecord
 * @property {string} defaultImport
 * @property {string} namespaceImport
 * @property {SingleImport[]} singleImports
 * @property {string} path
 */

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

  return {
    defaultImport,
    namespaceImport,
    singleImports,
    path: importNode.source.value
  };
}

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
 * @param {object} context 
 * @param {ASTNode} programNode
 * @param {[ number, number ]} range 
 * @param {ImportRecord[][]} groupedImportRecords 
 */
function reportUngroupedImports(context, programNode, [ start, end ], groupedImportRecords) {
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
        groupedImportRecords
          .map(importRecords => importRecords.map(getImportRecordAsCodeString).join('\n'))
          .join('\n\n')
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
    /**
     * @type {ImportRecord[][]}
     */
    const groupedImportRecords = new Array(groups.length).fill(0).map(_ => []);

    return {
      Program(programNode) {
        /**
         * @type {ImportNode[]}
         */
        const importNodes = programNode.body.filter(isImportNode);

        if (!importNodes.length) {
          return;
        }

        importNodes.forEach(importNode => {
          const importRecord = createImportRecord(importNode);
          let hasBeenGrouped = false;

          for (let i = 0; i < groups.length && !hasBeenGrouped; i++) {
            const group = groups[i];

            for (const match of group) {
              if (micromatch.isMatch(importRecord.path, match)) {
                groupedImportRecords[i].push(importRecord);

                hasBeenGrouped = true;

                break;
              }
            }
          }
        });

        /**
         * @type {[ number, number ]}
         */
        const range = [
          importNodes[0].start,
          importNodes[importNodes.length - 1].end
        ];

        reportUngroupedImports(context, programNode, range, groupedImportRecords);
      }
    };
  }
}