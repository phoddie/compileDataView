/*
* Copyright (c) 2021  Moddable Tech, Inc.
*
*   This file is part of the Moddable SDK Tools.
*
*   The Moddable SDK Tools is free software: you can redistribute it and/or modify
*   it under the terms of the GNU General Public License as published by
*   the Free Software Foundation, either version 3 of the License, or
*   (at your option) any later version.
*
*   The Moddable SDK Tools is distributed in the hope that it will be useful,
*   but WITHOUT ANY WARRANTY; without even the implied warranty of
*   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
*   GNU General Public License for more details.
*
*   You should have received a copy of the GNU General Public License
*   along with the Moddable SDK Tools.  If not, see <http://www.gnu.org/licenses/>.
*/

/*

	to do:

		- bitfields that align to byte and are a multiple of 8 in size special case
		- faster generated code for set of embedded views
		- initializers

*/

const byteCounts = {
	Int8: 1,
	Int16: 2,
	Int32: 4,
	Uint8: 1,
	Uint16: 2,
	Uint32: 4,
	Float32: 4,
	Float64: 8,
	BigInt64: 8,
	BigUint64: 8
};

const TypeAliases = {
	uint8_t:  "Uint8",
	uint16_t:  "Uint16",
	uint32_t:  "Uint32",
	uint64_t:  "BigUint64",
	int8_t:  "Int8",
	int16_t:  "Int16",
	int32_t:  "Int32",
	int64_t:  "BigInt64",
	float:  "Float32",
	double:  "Float64",
	boolean: "Boolean",
	bool: "Boolean"
};

const isTypedef = Symbol("typedef");

let className;
let output;
let classes;
let properties;
let bitfields;
let jsonOutput;
let fromOutput;
let byteOffset;
let lineNumber;
let littleEndian;
let doSet;
let doGet;
let doExport;
let pack;
let extendsClass;
let xs;
let outputByteLength;
let checkByteLength;
let union;
let enumState;
let classAlign;
let anonymousUnion;
let json;

const hex = "0123456789ABCDEF";
function toHex(value, byteCount = 4) {
	let result = "";
	let nybbles = byteCount * 2;
	while (value && nybbles--) {
		result = hex[value & 15] + result;
		value = (value & 0xFFFFFFF0) >>> 4;
	}
	return "0x" + (("" === result) ? "0" : result);
}

function booleanSetting(value, name) {
	if ("true" === value)
		return true;

	if ("false" === value)
		return false;

	throw new Error(`invalid ${name} "${value}" specified`);
}

function endField(byteCount) {
	if (undefined !== union)
		union = Math.max(byteCount, union);
	else
		byteOffset += byteCount;
}

function validateName(name) {
	//@@ naive
	if (name.includes(";") || name.includes("+")  || name.includes("-") || name.includes(".") || name.includes("&"))
		throw new Error(`invalid name "${name}"`);

	return name;
}

function splitSource(source) {
	let parts = [], part = "";
	let map = [];
	let line = 1;
	let directive = false, lineStart = true;

splitLoop:
	for (let i = 0, length = source.length, previous = "\n"; i < length; previous = source[i], i++) {
		const c = source[i]

		if ("\n" === c)
			lineStart = true;

		switch (c) {
			case "{":
			case "}":
			case ":":
			case ";":
			case "[":
			case "]":
			case "(":
			case ")":
			case "+":
			case "-":
			case "*":
			case "^":
			case "|":
			case "&":
			case "!":
			case ",":
			case "=":
				if (part) {
					parts.push(part);
					map.push(line);
				}
				parts.push(c);
				map.push(line);
				part = "";
				break;

			case "\n":
			case "\t":
			case " ":
				if (part) {
					parts.push(part);
					map.push(line);
				}
				if ("\n" === c) {
					if (directive) {
						directive = false;
						parts.push(c);
						map.push(line);
					}
					line += 1;
				}

				part = "";
				break;

			case "/":
				if ("/" === part) {
					part = "";
					i = source.indexOf("\n", i);
					if (i < 0)
						break splitLoop;
					i -= 1;		// so line ending is parsed
					continue splitLoop;
				}
				part += c;
				break;

			case "#":
				if (lineStart)
					directive = true;
				part += c;
				break;

			default:
				part += c;
				break;
		}

		if ((" " !== c) && ("\t" !== c) && ("\n" !== c))
			lineStart = false;
	}

	if (part) {
		parts.push(part);
		map.push(line);
	}

	return {parts, map};
}

function flushBitfields(bitsToAdd = 32) {
	let total = 0, type, endian, byteCount;

	for (let i = 0; i < bitfields.length; i++)
		total += bitfields[i].bitCount;

	if ((0 == total) || ((total + bitsToAdd) < 32))
		return;

	if (total <= 8) {
		type = "Uint8";
		byteCount = 1;
		endian = "";
	}
	else {
		type = (total <= 16) ? "Uint16" : "Uint32";
		byteCount = (total <= 16) ? 2 : 4;
		endian = ", true";
	}

	let bitOffset = 0;
	while (bitfields.length) {
		const bitfield = bitfields.shift();
		const mask = (2 ** bitfield.bitCount) - 1;
		const shiftLeft = bitOffset ? " << " + bitOffset : "";
		const shiftRight = bitOffset ? " >> " + bitOffset : "";

		if (doGet) {
			output.push(`   get ${bitfield.name}() {`);
			if (bitfield.boolean)
				output.push(`      return Boolean(this.get${type}(${byteOffset}${endian}) & ${toHex(mask << bitOffset, byteCount)});`);
			else
				output.push(`      return (this.get${type}(${byteOffset}${endian})${shiftRight}) & ${toHex(mask, byteCount)};`);
			output.push(`   }`);
		}

		if (doSet) {
			output.push(`   set ${bitfield.name}(value) {`);
			if (bitfield.boolean) {
				output.push(`      const t = this.get${type}(${byteOffset}${endian});`);
				output.push(`      this.set${type}(${byteOffset}, value ? (t | ${toHex(1 << bitOffset)}) : (t & ${toHex(~(mask << bitOffset), byteCount)})${endian});`);
			}
			else if (1 === bitfield.bitCount) {
				output.push(`      const t = this.get${type}(${byteOffset}${endian});`);
				output.push(`      this.set${type}(${byteOffset}, (value & 1) ? (t | ${toHex(1 << bitOffset)}) : (t & ${toHex(~(mask << bitOffset), byteCount)})${endian});`);
			}
			else {
				output.push(`      const t = this.get${type}(${byteOffset}${endian}) & ${toHex(~(mask << bitOffset), byteCount)};`);
				output.push(`      this.set${type}(${byteOffset}, t | ((value & ${toHex(mask, byteCount)})${shiftLeft})${endian});`);
			}
			output.push(`   }`);
		}

		bitOffset += bitfield.bitCount;
	}

	bitfields.length = 0;

	endField(byteCount);
}

const kDefaultPack = 16;

function compileDataView(input) {
	className = undefined;
	output = [];
	properties = [];
	classes = {};
	bitfields = [];
	jsonOutput = [];
	fromOutput = [];
	byteOffset = 0;
	lineNumber = 1;
	littleEndian = true;
	doSet = true;
	doGet = true;
	doExport = true;
	pack = kDefaultPack;
	extendsClass = "DataView";
	xs = true;
	outputByteLength = false;
	checkByteLength = true;
	union = undefined;
	enumState = undefined;
	classAlign = 0;
	anonymousUnion = false;
	json = false;

	let final = [];
	const errors = [];
	const lines = input.split("\n");

	const {parts, map} = splitSource(input);
	for (let pos = 0; pos < parts.length; ) {
		const part = parts[pos++];
		if (!part)
			debugger;

		try {
			let bitCount, byteCount, arrayCount;

			if ("}" == part) {
				if (!className)
					throw new Error(`unexpected }`);

				flushBitfields();

				if (undefined !== union) {
					if (0 === union)
						throw new Error(`empty union`);

					const byteLength = union;
					union = undefined;

					endField(byteLength);
					if (anonymousUnion) {
						anonymousUnion = false;

						if (";" !== parts[pos++])
							throw new Error(`expected semicolon`);

						continue;
					}
				}
				else
				if (undefined !== enumState) {
					output.push(`${doExport ? "export " : ""}const ${className} = Object.freeze({`);
					for (let [name, value] of enumState)
						output.push(`   ${name}: ${value},`);
					output.push(`});`);
					output.push(``);

					final = final.concat(output);
					output.length = 0;

					classes[className] = {
						byteLength: 4,
						align: Math.min(pack, 4),		// enum is int
					};
					TypeAliases[className] = "Int32"

					enumState = undefined;
					className = undefined;
					continue;
				}

				if (!byteOffset)
					throw new Error(`empty struct`);

				if (isTypedef === className) {
					className = validateName(parts[pos++]);
					if (classes[className])
						throw new Error(`duplicate class "${className}"`);
				}

				if (";" !== parts[pos++])
					throw new Error(`expected semicolon`);

				if (json) {
					if (doGet) {
						output.push(`   toJSON() {`);
						output.push(`      return {`);
						output = output.concat(jsonOutput);
						output.push(`      };`);
						output.push(`   }`);
					}
					jsonOutput.length = 0;

					if (doSet) {
						output.push(`   static from(obj) {`);
						output.push(`      const result = new ${className};`);
						output = output.concat(fromOutput);
						output.push(`      return result;`);
						output.push(`   }`);
					}
					fromOutput.length = 0;
				}

				output.push(`}`);
				output.push(``);

				const start = [];
				start.push(`${doExport ? "export " : ""}class ${className} extends ${extendsClass} {`);
				if (outputByteLength) {
					start.push(`   static byteLength = ${byteOffset};`);
					start.push(``);
				}

				const limit = checkByteLength ? `, ${byteOffset}` : "";
				start.push(`   constructor(data, offset) {`);
				start.push(`      if (data)`);
				start.push(`         super(data, offset ?? 0${limit});`);
				start.push(`       else`);
				start.push(`         super(new ArrayBuffer(${byteOffset}));`);
				start.push(`   }`);

				final = final.concat(start, output);

				classes[className] = {
					byteLength: byteOffset,
					align: classAlign
				};

				output.length = 0;
				byteOffset = 0;
				properties.length = 0;
				className = undefined;
				classAlign = 0;

				continue;
			}

			if ((part === "union") && ("{" === parts[pos])) {
				if (!className)
					throw new Error(`anonymous union must be in struct`);

				if (undefined !== union)
					throw new Error(`no nested unions`);

				union = 0;
				anonymousUnion = true;

				pos += 1;
				continue;
			}

			if (part === "union") {
				if ("{" !== parts[pos + 1])
					throw new Error(`open brace expected`);

				className = validateName(parts[pos]);
				if (classes[className])
					throw new Error(`duplicate class "${className}"`);
				classAlign = 1;

				union = 0;
				anonymousUnion = false;

				pos += 2;
				continue;
			}

			if (part === "enum") {
				if (className)
					throw new Error(`enum must be at root`);

				className = validateName(parts[pos++]);
				if (classes[className])
					throw new Error(`duplicate name "${enumState.name}"`);

				enumState = new Map;
				enumState.value = 0;

				if ("{" !== parts[pos++])
					throw new Error(`open brace expected`);

				continue;
			}

			if (("typedef" === part) && ("struct" === parts[pos])) {
				if (className)
					throw new Error(`cannot nest structure`);

				if ("{" !== parts[pos + 1])
					throw new Error(`open brace expected`);

				className = isTypedef;
				classAlign = 1;
				jsonOutput = [];
				fromOutput = [];

				pos += 2;
				continue;
			}

			if ("struct" === part) {
				if (className)
					throw new Error(`cannot nest structure`);

				if ("{" !== parts[pos + 1])
					throw new Error(`open brace expected`);

				className = validateName(parts[pos]);
				if (classes[className])
					throw new Error(`duplicate class "${className}"`);
				classAlign = 1;
				jsonOutput = [];
				fromOutput = [];

				pos += 2;
				continue;
			}

			if ("#pragma" === part) {
				let setting = parts[pos++];
				if ("(" !== parts[pos++])
					throw new Error(`open parenthesis expected`);
				let value = parts[pos++];

				switch (setting) {
					case "extends":
						extendsClass = validateName(value);
						break;

					case "endian":
						if ("little" == value)
							littleEndian = true;
						else if ("big" == value)
							littleEndian = false;
						else
							throw new Error(`invalid endian "${value}" specified`);
						break;

					case "pack":
						if (")" === value) {
							value =  kDefaultPack;
							pos -= 1;
						}
						else {
							value = parseInt(value);
							if (0 === value)
								value = kDefaultPack;
							if (![1, 2, 4, 8, 16].includes(value))
								throw new Error(`invalid pack`);
						}
						pack = value;
						break;

					case "xs":
						xs = booleanSetting(value, setting);
						break;

					case "set":
						doSet = booleanSetting(value, setting);
						break;

					case "get":
						doGet = booleanSetting(value, setting);
						break;

					case "export":
						doExport = booleanSetting(value, setting);
						break;

					case "outputByteLength":
						outputByteLength = booleanSetting(value, setting);
						break;

					case "checkByteLength":
						checkByteLength = booleanSetting(value, setting);
						break;

					case "json":
						json = booleanSetting(value, setting);
						break;

					default:
						throw new Error(`unknown pragma "${setting}"`);
						break;
				}

				if (")" !== parts[pos++])
					throw new Error(`close parenthesis expected`);

				if ("\n" !== parts[pos++])
					throw new Error(`end of line expected`);

				continue;
			}

			if (part.startsWith("#"))
				throw new Error(`invalid preprocessor instruction`);

			if (";" === part)
				continue;

			if (!className)
				throw new Error(`unexpected`);

			if (enumState) {
				if (enumState.has(part))
					throw new Error(`duplicate name ${part} in enum`);

				let value = ++enumState.value;
				if ("=" === parts[pos]) {
					enumState.value = value = parseInt(parts[++pos]);
					if (isNaN(value))
						throw new Error(`invalid value for ${part}`);
					pos += 1;
				}

				if ("," === parts[pos])
					pos += 1;
				else if ("}" === parts[pos])
					;
				else
					throw new Error(`syntax error`);

				enumState.set(part, value);

				continue;
			}


			let type = part;
			let name = validateName(parts[pos++]);

			if (":" === parts[pos]) {
				pos++;
				bitCount = parseInt(parts[pos++]);
				if ((bitCount <= 0) || (bitCount > 32) || isNaN(bitCount))
					throw new Error(`invalid bit count`);
			}
			else {
				if ("[" == parts[pos]) {
					if ("]" !== parts[pos + 2])
						throw new Error(`right brace expected`);

					arrayCount = parseInt(parts[pos + 1]);
					pos += 3;

					if ((arrayCount <= 0) || isNaN(arrayCount))
						throw new Error(`invalid array count`);
				}
			}

			if (properties.includes(name))
				throw new Error(`duplicate name "${name}"`);
			properties.push(name);

			if (";" !== parts[pos++])
				throw new Error(`expected semicolon`);

			if (TypeAliases[type])
				type = TypeAliases[type];

			switch (type) {
				case "Float32":
				case "Float64":
				case "Int8":
				case "Int16":
				case "Int32":
				case "Uint8":
				case "Uint16":
				case "Uint32":
				case "BigInt64":
				case "BigUint64": {
					flushBitfields();
					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					const byteCount = byteCounts[type];

					const align = Math.min(pack, byteCount);
					if (byteOffset % align)
						endField(align - (byteOffset % align));

					if (classAlign < align)
						classAlign = align;

					if (doGet) {
						output.push(`   get ${name}() {`);
						if (undefined === arrayCount) {
							if (1 === byteCount)
								output.push(`      return this.get${type}(${byteOffset});`);
							else
								output.push(`      return this.get${type}(${byteOffset}, ${littleEndian});`);
						}
						else {
							output.push(`      return new ${type}Array(this.buffer, this.byteOffset${byteOffset ? (" + " + byteOffset) : ""}, ${arrayCount * byteCount});`);
						}
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						if (undefined === arrayCount) {
							if (1 === byteCount)
								output.push(`      this.set${type}(${byteOffset}, value);`);
							else
								output.push(`      this.set${type}(${byteOffset}, value, ${littleEndian});`);
						}
						else {
							output.push(`      for (let i = 0, j = ${byteOffset}; i < ${arrayCount}; i++, j += ${byteCount})`);
							output.push(`         this.set${type}(j, value[i]);`);
						}

						output.push(`   }`);
					}

					endField((arrayCount ?? 1) * byteCount);

					if (undefined === arrayCount)
						jsonOutput.push(`         ${name}: this.${name},`);
					else
						jsonOutput.push(`         ${name}: Array.from(this.${name}),`);

					fromOutput.push(`      if ("${name}" in obj) result.${name} = obj.${name};`);
					} break;

				case "char":
					flushBitfields();

					if (undefined !== bitCount)
						throw new Error(`char cannot use bitfield`);

					if (doGet) {
						output.push(`   get ${name}() {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return String.fromCharCode(this.getUint8(${byteOffset}));`);
						else {
							if (xs)
								output.push(`      return String.fromArrayBuffer(this.buffer.slice(this.byteOffset + ${byteOffset}, this.byteOffset + ${byteOffset + arrayCount}));`);
							else
								output.push(`      return TextDecoder().decode(this.byteOffset +  this.buffer.slice(${byteOffset}, this.byteOffset + ${byteOffset + arrayCount}));`);
						}
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return this.setUint8(${byteOffset}, value.charCodeAt());`);
						else {
							if (xs)
								output.push(`      value = new Uint8Array(ArrayBuffer.fromString(value));`);
							else
								output.push(`      value = new TextEncoder().encode(value);`);
							output.push(`      const byteLength = value.byteLength;`);
							output.push(`      if (byteLength > ${arrayCount})`);
							output.push(`         throw new Error("too long");`);
							output.push(`      for (let i = 0; i < byteLength; i++)`);
							output.push(`         this.setUint8(${byteOffset} + i, value[i]);`);
							output.push(`      for (let i = byteLength; i < ${arrayCount}; i++)`);
							output.push(`         this.setUint8(${byteOffset} + i, 0);`);
						}
						output.push(`   }`);
					}

					endField(arrayCount ?? 1);

					jsonOutput.push(`         ${name}: this.${name},`);

					fromOutput.push(`      if ("${name}" in obj) result.${name} = obj.${name};`);
					break;

				case "Uint":
					if (undefined === bitCount)
						throw new Error(`number of bits in bitfield missing`);

					flushBitfields(bitCount);

					bitfields.push({
						name,
						bitCount
					});

					jsonOutput.push(`         ${name}: this.${name},`);

					fromOutput.push(`      if ("${name}" in obj) result.${name} = obj.${name};`);
					break;

				case "Boolean":
					flushBitfields(1);

					if (undefined !== arrayCount)
						throw new Error(`Boolean cannot have array`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					bitfields.push({
						name,
						bitCount: 1,
						boolean: true
					});

					jsonOutput.push(`         ${name}: this.${name},`);

					fromOutput.push(`      if ("${name}" in obj) result.${name} = obj.${name};`);
					break;

				default: {
					if (!classes[type])
						throw new Error(`unknown type "${type}"`);

					flushBitfields();

					if (undefined !== arrayCount)
						throw new Error(`${type} cannot have array`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					const align = Math.min(pack, classes[type].align);
					if (byteOffset % align)
						endField(align - (byteOffset % align));

					if (doGet) {
						output.push(`   get ${name}() {`);
						output.push(`      return new ${type}(this.buffer, this.byteOffset${byteOffset ? (" + " + byteOffset) : ""});`);
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						output.push(`      for (let i = 0; i < ${classes[type].byteLength}; i++)`);
						output.push(`         this.setUint8(i + ${byteOffset}, value.getUint8(i));`);
						output.push(`   }`);
					}

					endField(classes[type].byteLength);

					jsonOutput.push(`         ${name}: this.${name}.toJSON(),`);

					fromOutput.push(`      if ("${name}" in obj) result.${name} = ${type}.from(obj.${name});`);
					} break;
			}
		}
		catch (e) {
			errors.push(`   ${e}, line ${map[pos]}: ${lines[map[pos] - 1]}`);
		}
	}

	if (className)
		errors.push(`   incomplete struct at end of file`);

	final.push("/*");
	final.push("");
	final.push(`View classes generated by https://phoddie.github.io/compileDataView on ${new Date} from the following description:`);
	final.push("");
	final.push(input);
	final.push("*/");

	if (errors.length) {
		errors.unshift("/*")
		errors.push("*/")
		errors.push("")
	}

	return {
		script: final.join("\n"),
		errors: errors.join("\n")
	}
}
globalThis.compileDataView = compileDataView;

export default {};
