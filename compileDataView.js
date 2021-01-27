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
}

let className;
let output;
let classes;
let properties;
let bitfields;
let byteOffset;
let lineNumber;
let littleEndian;
let doSet;
let doGet;
let doExport;
let pack;
let extendsClass;
let xs;
let byteLength;
let union;

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

function compileDataView(input) {
	className = undefined;
	output = [];
	properties = [];
	classes = {};
	bitfields = [];
	byteOffset = 0;
	lineNumber = 1;
	littleEndian = true;
	doSet = true;
	doGet = true;
	doExport = true;
	pack = true;
	extendsClass = "DataView";
	xs = true;
	byteLength = false;
	union = undefined;

	let final = [];
	const errors = [];

	const lines = input.split("\n");

	for (; lines.length; lineNumber += 1) {
		const originalLine = lines.shift().trimStart().trimEnd();

		try {
			let bitCount, byteCount, arrayCount;
			let line = originalLine.replaceAll("\t", " ");
			if (!line)
				continue;

			if (line.startsWith("//"))
				continue;

			if (line.startsWith("}")) {
				if (!className)
					throw new Error(`unexpected }`);

				flushBitfields();

				if (undefined !== union) {
					if (0 === union)
						throw new Error(`empty union`);

					const byteLength = union;
					union = undefined;

					endField(byteLength);
					continue;
				}

				if (!byteOffset)
					throw new Error(`empty struct`);

				output.push(`}`);
				output.push(``);

				const start = [];
				start.push(`${doExport ? "export " : ""}class ${className} extends ${extendsClass} {`);
				if (byteLength) {
					start.push(`   static byteLength = ${byteOffset};`);
					start.push(``);
				}
				start.push(`   constructor(data, offset) {`);
				start.push(`      if (data)`);
				start.push(`         super(data, offset ?? 0, ${byteOffset});`);
				start.push(`       else`);
				start.push(`         super(new ArrayBuffer(${byteOffset}));`);
				start.push(`   }`);

				final = final.concat(start, output);

				classes[className] = {
					byteLength: byteOffset
				};

				output.length = 0;
				byteOffset = 0;
				properties.length = 0;
				className = undefined;

				continue;
			}

			if (line.startsWith("union")) {
				line = line.slice(5).trimStart();

				if (!line.startsWith("{"))
					throw new Error(`invalid union`);

				if (!className)
					throw new Error(`union must be in struct`);

				if (undefined !== union)
					throw new Error(`no nested unions`);

				union = 0;
				continue;
			}

			if (line.startsWith("struct ")) {
				if (className)
					throw new Error(`cannot nest structure"`);

				line = line.slice(7).trimStart();
				let brace = line.indexOf("{");
				if (brace < 0)
					throw new Error(`open brace expected`);

				let value = line.slice(0, brace).trimStart().trimEnd();
				if (!value)
					throw new Error(`name expected`);

				className = value;
				if (classes[className])
					throw new Error(`duplicate class "${className}"`);

				continue;
			}

			if (line.startsWith("#pragma ")) {
				line = line.slice(8).trimStart();

				let parenL = line.indexOf("(");
				if (parenL < 0)
					throw new Error(`open parenthesis expected`);

				let parenR = line.indexOf(")", parenL);
				if (parenR < 0)
					throw new Error(`close parenthesis expected`);

				let setting = line.slice(0, parenL).trimStart().trimEnd();
				if (!setting)
					throw new Error(`pragma name expected`);

				let value = line.slice(parenL + 1, parenR).trimStart().trimEnd();
				if (!value)
					throw new Error(`pragma value expected`);

				switch (setting) {
					case "extends":
						extendsClass = value;
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
						pack = booleanSetting(value, setting);
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

					case "byteLength":
						byteLength = booleanSetting(value, setting);
						break;

					default:
						throw new Error(`unknown pragma "${setting}"`);
						break;
				}

				continue;
			}

			if (line.startsWith("#"))
				throw new Error(`invalid preprocessor instruction"`);

			let space = line.indexOf(" ");
			if (space < 0)
				throw new Error(`space expected`);
			let type = line.slice(0, space);
			line = line.slice(space).trimStart();

			let semicolon = line.indexOf(";");
			if (semicolon < 0)
				throw new Error(`semicolon expected`);
			let name = line.slice(0, semicolon);

			const colon = name.indexOf(":");
			if (colon > 0) {
				bitCount = parseInt(name.slice(colon + 1));
				if ((bitCount <= 0) || (bitCount > 32) || isNaN(bitCount))
					throw new Error(`invalid bit count`);
				name = name.slice(0, colon);
			}
			else {
				let leftBrace = name.indexOf("[");
				if (leftBrace >= 0) {
					let rightBrace = name.indexOf("]");
					if (rightBrace < 0)
						throw new Error(`right brace expected`);
					arrayCount = parseInt(name.slice(leftBrace + 1, rightBrace));
					if ((arrayCount <= 0) || isNaN(arrayCount))
						throw new Error(`invalid array count`);
					name = name.slice(0, leftBrace);
				}
			}
			name = name.trimEnd();

			if (name.includes(" "))		//@@ check for other invalid characters
				throw new Error(`space in name "${name}"`);

			if (properties.includes(name))
				throw new Error(`duplicate name "${name}"`);
			properties.push(name);

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
				case "BigUint64":
					flushBitfields();
					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					const byteCount = byteCounts[type];

					if (!pack && (byteOffset % byteCount))
						endField(byteCount - (byteOffset % byteCount));

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
					break;

				case "char":
				case "String":
					flushBitfields();

					if (undefined !== bitCount)
						throw new Error(`char cannot use bitfield`);

					if (("String" === type) && (undefined == arrayCount))
						throw new Error(`String requires array count`);

					if (doGet) {
						output.push(`   get ${name}() {`);
						if ((undefined === arrayCount) || (1 === arrayCount))
							output.push(`      return String.fromCharCode(this.getUint8(${byteOffset}));`);
						else {
							if (xs)
								output.push(`      return String.fromArrayBuffer(this.buffer.slice(${byteOffset}, ${byteOffset + arrayCount}));`);
							else
								output.push(`      return TextDecoder().decode(this.buffer.slice(${byteOffset}, ${byteOffset + arrayCount}));`);
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
					break;

				case "Uint":
					if (undefined === bitCount)
						throw new Error(`number of bits in bitfield missing`);

					flushBitfields(bitCount);

					bitfields.push({
						name,
						bitCount
					});
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
					break;

				default:
					if (!classes[type])
						throw new Error(`unknown type "${type}"`);

					flushBitfields();

					if (undefined !== arrayCount)
						throw new Error(`${type} cannot have array`);

					if (undefined !== bitCount)
						throw new Error(`cannot use bitfield with "${type}"`);

					if (doGet) {
						output.push(`   get ${name}() {`);
							output.push(`      return new ${type}(this.buffer, this.byteOffset${byteOffset ? (" + " + byteOffset) : ""}, ${classes[type].byteLength});`);
						output.push(`   }`);
					}

					if (doSet) {
						output.push(`   set ${name}(value) {`);
						output.push(`      for (let i = 0; i < ${classes[type].byteLength}; i++)`);
						output.push(`         this.setUint8(i + ${byteOffset}, value.getUint8(i));`);
						output.push(`   }`);
					}

					endField(classes[type].byteLength);
					break;
			}
		}
		catch (e) {
			errors.push(`   ${e}, line ${lineNumber}: ${originalLine}`);
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
