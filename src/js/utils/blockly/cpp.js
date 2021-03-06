import Blockly from 'node-blockly/browser';
const goog = Blockly.goog;

/**
 * @license
 * Visual Blocks Language
 *
 * Copyright 2014 Google Inc.
 * https://developers.google.com/blockly/
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @fileoverview Helper functions for generating Cpp for blocks.
 * @author fraser@google.com (Neil Fraser)
 */
'use strict';

goog.provide('Blockly.Cpp');

goog.require('Blockly.Generator');


/**
 * Cpp code generator.
 * @type {!Blockly.Generator}
 */
Blockly.Cpp = new Blockly.Generator('Cpp');

/**
 * List of illegal variable names.
 * This is not intended to be a security feature.  Blockly is 100% client-side,
 * so bypassing this list is trivial.  This is intended to prevent users from
 * accidentally clobbering a built-in object or function.
 * @private
 */
Blockly.Cpp.addReservedWords(
    // https://www.Cpplang.org/docs/spec/latest/Cpp-language-specification.pdf
    // Section 16.1.1
    'assert,break,case,catch,class,const,continue,default,do,else,enum,' +
    'extends,false,final,finally,for,if,in,is,new,null,rethrow,return,super,' +
    'switch,this,throw,true,try,var,void,while,with,' +
    // https://api.Cpplang.org/Cpp_core.html
    'print,identityHashCode,identical,BidirectionalIterator,Comparable,' +
    'double,Function,int,Invocation,Iterable,Iterator,List,Map,Match,num,' +
    'Pattern,RegExp,Set,StackTrace,String,StringSink,Type,bool,DateTime,' +
    'Deprecated,Duration,Expando,Null,Object,RuneIterator,Runes,Stopwatch,' +
    'StringBuffer,Symbol,Uri,Comparator,AbstractClassInstantiationError,' +
    'ArgumentError,AssertionError,CastError,ConcurrentModificationError,' +
    'CyclicInitializationError,Error,Exception,FallThroughError,' +
    'FormatException,IntegerDivisionByZeroException,NoSuchMethodError,' +
    'NullThrownError,OutOfMemoryError,RangeError,StackOverflowError,' +
    'StateError,TypeError,UnimplementedError,UnsupportedError'
);

/**
 * Order of operation ENUMs.
 * https://www.Cpplang.org/docs/Cpp-up-and-running/ch02.html#operator_table
 */
Blockly.Cpp.ORDER_ATOMIC = 0;         // 0 "" ...
Blockly.Cpp.ORDER_UNARY_POSTFIX = 1;  // expr++ expr-- () [] . ?.
Blockly.Cpp.ORDER_UNARY_PREFIX = 2;   // -expr !expr ~expr ++expr --expr
Blockly.Cpp.ORDER_MULTIPLICATIVE = 3; // * / % ~/
Blockly.Cpp.ORDER_ADDITIVE = 4;       // + -
Blockly.Cpp.ORDER_SHIFT = 5;          // << >>
Blockly.Cpp.ORDER_BITWISE_AND = 6;    // &
Blockly.Cpp.ORDER_BITWISE_XOR = 7;    // ^
Blockly.Cpp.ORDER_BITWISE_OR = 8;     // |
Blockly.Cpp.ORDER_RELATIONAL = 9;     // >= > <= < as is is!
Blockly.Cpp.ORDER_EQUALITY = 10;      // == !=
Blockly.Cpp.ORDER_LOGICAL_AND = 11;   // &&
Blockly.Cpp.ORDER_LOGICAL_OR = 12;    // ||
Blockly.Cpp.ORDER_IF_NULL = 13;       // ??
Blockly.Cpp.ORDER_CONDITIONAL = 14;   // expr ? expr : expr
Blockly.Cpp.ORDER_CASCADE = 15;       // ..
Blockly.Cpp.ORDER_ASSIGNMENT = 16;    // = *= /= ~/= %= += -= <<= >>= &= ^= |=
Blockly.Cpp.ORDER_NONE = 99;          // (...)

/**
 * Initialise the database of variable names.
 * @param {!Blockly.Workspace} workspace Workspace to generate code from.
 */
Blockly.Cpp.init = function(workspace) {
  // Create a dictionary of definitions to be printed before the code.
  Blockly.Cpp.definitions_ = Object.create(null);
  // Create a dictionary mapping desired function names in definitions_
  // to actual function names (to avoid collisions with user functions).
  Blockly.Cpp.functionNames_ = Object.create(null);

  if (!Blockly.Cpp.variableDB_) {
    Blockly.Cpp.variableDB_ =
        new Blockly.Names(Blockly.Cpp.RESERVED_WORDS_);
  } else {
    Blockly.Cpp.variableDB_.reset();
  }

  var defvars = [];
  var variables = workspace.getAllVariables();
  if (variables.length) {
    for (var i = 0; i < variables.length; i++) {
      defvars[i] = Blockly.Cpp.variableDB_.getName(variables[i].name,
          Blockly.Variables.NAME_TYPE);
    }
    Blockly.Cpp.definitions_['variables'] =
        'var ' + defvars.join(', ') + ';';
  }
};

/**
 * Prepend the generated code with the variable definitions.
 * @param {string} code Generated code.
 * @return {string} Completed code.
 */
Blockly.Cpp.finish = function(code) {
  // Indent every line.
 /* if (code) {
    code = Blockly.Cpp.prefixLines(code, Blockly.Cpp.INDENT);
  }
  code = "#include <Engine.h>\n" + "#include <Lamp.h>\n" + "#include " + "<" + "time.h" + ">" + "\n\n" + "int main() {\n" + code + "    " + "return 0; \n}";
*/
  // Convert the definitions dictionary into a list.
  var imports = [];
  var definitions = [];
  for (var name in Blockly.Cpp.definitions_) {
    var def = Blockly.Cpp.definitions_[name];
    if (def.match(/^import\s/)) {
      imports.push(def);
    } else {
      definitions.push(def);
    }
  }
  // Clean up temporary data.
  delete Blockly.Cpp.definitions_;
  delete Blockly.Cpp.functionNames_;
  Blockly.Cpp.variableDB_.reset();
  var allDefs = imports.join('\n') + '\n\n' + definitions.join('\n\n');
  return allDefs.replace(/\n\n+/g, '\n\n').replace(/\n*$/, '\n\n\n') + code;
};

/**
 * Naked values are top-level blocks with outputs that aren't plugged into
 * anything.  A trailing semicolon is needed to make this legal.
 * @param {string} line Line of generated code.
 * @return {string} Legal line of code.
 */
Blockly.Cpp.scrubNakedValue = function(line) {
  return line + ';\n';
};

/**
 * Encode a string as a properly escaped Cpp string, complete with quotes.
 * @param {string} string Text to encode.
 * @return {string} Cpp string.
 * @private
 */
Blockly.Cpp.quote_ = function(string) {
  // Can't use goog.string.quote since $ must also be escaped.
  string = string.replace(/\\/g, '\\\\')
                 .replace(/\n/g, '\\\n')
                 .replace(/\$/g, '\\$')
                 .replace(/'/g, '\\\'');
  return '\'' + string + '\'';
};

/**
 * Common tasks for generating Cpp from blocks.
 * Handles comments for the specified block and any connected value blocks.
 * Calls any statements following this block.
 * @param {!Blockly.Block} block The current block.
 * @param {string} code The Cpp code created for this block.
 * @return {string} Cpp code with comments and subsequent blocks added.
 * @private
 */
Blockly.Cpp.scrub_ = function(block, code) {
  var commentCode = '';
  // Only collect comments for blocks that aren't inline.
  if (!block.outputConnection || !block.outputConnection.targetConnection) {
    // Collect comment for this block.
    var comment = block.getCommentText();
    comment = Blockly.utils.wrap(comment, Blockly.Cpp.COMMENT_WRAP - 3);
    if (comment) {
      if (block.getProcedureDef) {
        // Use documentation comment for function comments.
        commentCode += Blockly.Cpp.prefixLines(comment + '\n', '/// ');
      } else {
        commentCode += Blockly.Cpp.prefixLines(comment + '\n', '// ');
      }
    }
    // Collect comments for all value arguments.
    // Don't collect comments for nested statements.
    for (var i = 0; i < block.inputList.length; i++) {
      if (block.inputList[i].type == Blockly.INPUT_VALUE) {
        var childBlock = block.inputList[i].connection.targetBlock();
        if (childBlock) {
          var comment = Blockly.Cpp.allNestedComments(childBlock);
          if (comment) {
            commentCode += Blockly.Cpp.prefixLines(comment, '// ');
          }
        }
      }
    }
  }
  var nextBlock = block.nextConnection && block.nextConnection.targetBlock();
  var nextCode = Blockly.Cpp.blockToCode(nextBlock);
  return commentCode + code + nextCode;
};

/**
 * Gets a property and adjusts the value while taking into account indexing.
 * @param {!Blockly.Block} block The block.
 * @param {string} atId The property ID of the element to get.
 * @param {number=} opt_delta Value to add.
 * @param {boolean=} opt_negate Whether to negate the value.
 * @param {number=} opt_order The highest order acting on this value.
 * @return {string|number}
 */
Blockly.Cpp.getAdjusted = function(block, atId, opt_delta, opt_negate,
    opt_order) {
  var delta = opt_delta || 0;
  var order = opt_order || Blockly.Cpp.ORDER_NONE;
  if (block.workspace.options.oneBasedIndex) {
    delta--;
  }
  var defaultAtIndex = block.workspace.options.oneBasedIndex ? '1' : '0';
  if (delta) {
    var at = Blockly.Cpp.valueToCode(block, atId,
        Blockly.Cpp.ORDER_ADDITIVE) || defaultAtIndex;
  } else if (opt_negate) {
    var at = Blockly.Cpp.valueToCode(block, atId,
        Blockly.Cpp.ORDER_UNARY_PREFIX) || defaultAtIndex;
  } else {
    var at = Blockly.Cpp.valueToCode(block, atId, order) ||
        defaultAtIndex;
  }

  if (Blockly.isNumber(at)) {
    // If the index is a naked number, adjust it right now.
    at = parseInt(at, 10) + delta;
    if (opt_negate) {
      at = -at;
    }
  } else {
    // If the index is dynamic, adjust it in code.
    if (delta > 0) {
      at = at + ' + ' + delta;
      var innerOrder = Blockly.Cpp.ORDER_ADDITIVE;
    } else if (delta < 0) {
      at = at + ' - ' + -delta;
      var innerOrder = Blockly.Cpp.ORDER_ADDITIVE;
    }
    if (opt_negate) {
      if (delta) {
        at = '-(' + at + ')';
      } else {
        at = '-' + at;
      }
      var innerOrder = Blockly.Cpp.ORDER_UNARY_PREFIX;
    }
    innerOrder = Math.floor(innerOrder);
    order = Math.floor(order);
    if (innerOrder && order >= innerOrder) {
      at = '(' + at + ')';
    }
  }
  return at;
};
